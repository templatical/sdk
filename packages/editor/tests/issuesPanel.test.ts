// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { createDefaultTemplateContent } from "@templatical/types";
import { mount } from "@vue/test-utils";
import IssuesPanel from "../src/components/sidebar/IssuesPanel.vue";
import {
  TEMPLATE_LINT_KEY,
  EDITOR_KEY,
  TRANSLATIONS_KEY,
  SIZE_CHECK_KEY,
} from "../src/keys";
import type { LintIssue } from "../src/composables/useTemplateLint";

// The scroll needs real layout; `tests/useScrollToBlock.test.ts` covers what
// the composable does, so here it is stubbed and asserted on.
const scrollToBlock = vi.hoisted(() => vi.fn());
vi.mock("../src/composables/useScrollToBlock", () => ({
  useScrollToBlock: () => scrollToBlock,
}));

const selectBlock = vi.hoisted(() => vi.fn());

beforeEach(() => {
  scrollToBlock.mockClear();
  selectBlock.mockClear();
});

const translationsStub = {
  issues: {
    panelTitle: "Issues",
    panelTabLabel: "Issues",
    groupErrors: "Errors",
    groupWarnings: "Warnings",
    groupInfo: "Info",
    jump: "Jump to block",
    fix: "Fix",
    emptyState: "No issues — looking good.",
    badgeError: "Has errors",
    badgeWarning: "Has warnings",
    issueCountTooltip: "{count} issue(s)",
    learnMore: "Learn more",
    checkSize: "Check size",
    checkingSize: "Checking size",
    sizeResult: "HTML size: {size} KB",
    sizeOutdated: "Out of date",
    sizeError: "Size check failed: {error}",
  },
} as never;

function mountPanel(
  issues: LintIssue[],
  applyFix = vi.fn(),
  sizeCheck?: {
    renderHtml: () => Promise<string>;
    canRenderHtml: () => boolean;
    cloud: boolean;
    options: {
      locale?: string;
      compatibility?: false | { rules?: Record<string, string> };
    };
  },
  content = ref(createDefaultTemplateContent()),
) {
  return mount(IssuesPanel, {
    global: {
      provide: {
        [TEMPLATE_LINT_KEY as symbol]: {
          issues: ref(issues),
          ready: ref(true),
          unavailable: ref(false),
          applyFix,
          destroy: () => {},
        },
        [EDITOR_KEY as symbol]: { selectBlock, content },
        ...(sizeCheck ? { [SIZE_CHECK_KEY as symbol]: sizeCheck } : {}),
        [TRANSLATIONS_KEY as symbol]: translationsStub,
      },
    },
  });
}

describe("IssuesPanel", () => {
  it("jumping to an issue selects the block and scrolls it into view", async () => {
    // Selecting alone leaves the canvas where it was, so on a long template
    // "Jump" looked like it did nothing (the same defect as issue #568).
    const issues: LintIssue[] = [
      {
        blockId: "b1",
        ruleId: "a11y.image-missing-alt",
        severity: "error",
        message: "Image has no alt text.",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
      },
    ];
    const wrapper = mountPanel(issues);

    await wrapper.find('button[data-testid="issue-jump"]').trigger("click");

    expect(selectBlock).toHaveBeenCalledWith("b1");
    expect(scrollToBlock).toHaveBeenCalledWith("b1");
  });

  it("offers no jump for a template-level issue with no block", () => {
    // Nothing to scroll to, so the affordance must not render at all rather
    // than render and do nothing.
    const issues: LintIssue[] = [
      {
        ruleId: "structure.duplicate-ids",
        severity: "warning",
        message: "Duplicate block ids.",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
      },
    ];
    const wrapper = mountPanel(issues);

    expect(wrapper.find('button[data-testid="issue-jump"]').exists()).toBe(
      false,
    );
    expect(scrollToBlock).not.toHaveBeenCalled();
  });

  it("renders the empty state when no issues exist", () => {
    const wrapper = mountPanel([]);
    expect(wrapper.text()).toContain("No issues — looking good.");
  });

  it("renders Fix button only when issue.fix is defined", () => {
    const apply = vi.fn();
    const issues: LintIssue[] = [
      {
        blockId: "b1",
        ruleId: "structure.empty-section",
        severity: "warning",
        message: "Empty section.",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
        fix: { description: "Remove", apply },
      },
      {
        blockId: "b2",
        ruleId: "a11y.heading-skip-level",
        severity: "error",
        message: "Skipped a level.",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
        // no fix
      },
    ];
    const wrapper = mountPanel(issues);
    const buttons = wrapper.findAll("button");
    const buttonTexts = buttons.map((b) => b.text().trim());

    expect(buttonTexts.filter((t) => t === "Fix")).toHaveLength(1);
    expect(buttonTexts.filter((t) => t === "Jump to block")).toHaveLength(2);
  });

  it("renders Jump button only when issue.blockId is set", () => {
    const issues: LintIssue[] = [
      {
        blockId: null,
        ruleId: "a11y.missing-preheader",
        severity: "warning",
        message: "No preheader.",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
      },
    ];
    const wrapper = mountPanel(issues);
    const buttonTexts = wrapper.findAll("button").map((b) => b.text().trim());
    expect(buttonTexts.filter((t) => t === "Jump to block")).toHaveLength(0);
  });

  it("calls applyFix with the issue when the Fix button is clicked", async () => {
    const apply = vi.fn();
    const fix = { description: "Remove", apply };
    const issue: LintIssue = {
      blockId: "b1",
      ruleId: "structure.empty-section",
      severity: "warning",
      message: "Empty section.",
      suggestion: "Fix it.",
      reference: "https://docs.templatical.com/quality/",
      fix,
    };
    const applyFixSpy = vi.fn();
    const wrapper = mountPanel([issue], applyFixSpy);
    const fixButton = wrapper
      .findAll("button")
      .find((b) => b.text().trim() === "Fix");
    expect(fixButton).toBeDefined();
    await fixButton!.trigger("click");
    expect(applyFixSpy).toHaveBeenCalledTimes(1);
    expect(applyFixSpy.mock.calls[0][0].ruleId).toBe("structure.empty-section");
  });

  it("groups issues by severity (errors first, then warnings)", () => {
    const issues: LintIssue[] = [
      {
        blockId: "b1",
        ruleId: "x.warn",
        severity: "warning",
        message: "warn-msg",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
      },
      {
        blockId: "b2",
        ruleId: "x.err",
        severity: "error",
        message: "err-msg",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
      },
    ];
    const wrapper = mountPanel(issues);
    const html = wrapper.html();
    const errIdx = html.indexOf("err-msg");
    const warnIdx = html.indexOf("warn-msg");
    expect(errIdx).toBeGreaterThan(-1);
    expect(warnIdx).toBeGreaterThan(-1);
    expect(errIdx).toBeLessThan(warnIdx);
  });

  it("shows total count badge when issues exist", () => {
    const issues: LintIssue[] = [
      {
        blockId: "b1",
        ruleId: "a.x",
        severity: "error",
        message: "m1",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
      },
      {
        blockId: "b2",
        ruleId: "a.y",
        severity: "warning",
        message: "m2",
        suggestion: "Fix it.",
        reference: "https://docs.templatical.com/quality/",
      },
    ];
    const wrapper = mountPanel(issues);
    expect(wrapper.find('[title*="2 issue"]').exists()).toBe(true);
  });

  it("shows the suggestion and opens the reference safely", () => {
    const wrapper = mountPanel([
      {
        blockId: "b1",
        ruleId: "a11y.img-missing-alt",
        severity: "error",
        message: "Missing alt.",
        suggestion: "Add alt text.",
        reference: "https://www.w3.org/WAI/tutorials/images/",
      },
    ]);
    expect(wrapper.text()).toContain("Add alt text.");
    expect(wrapper.find("a").attributes()).toMatchObject({
      href: "https://www.w3.org/WAI/tutorials/images/",
      target: "_blank",
      rel: "noopener",
    });
  });

  it("checks compiled size only on demand, then marks it stale after an edit", async () => {
    const content = ref(createDefaultTemplateContent());
    const renderHtml = vi.fn(async () => "x".repeat(92_161));
    const wrapper = mountPanel(
      [],
      vi.fn(),
      { renderHtml, canRenderHtml: () => true, cloud: false, options: {} },
      content,
    );
    expect(renderHtml).not.toHaveBeenCalled();
    await wrapper.find('[data-testid="issue-check-size"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("90.0 KB"));
    expect(renderHtml).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Gmail clips");
    content.value.settings.textColor = "#123456";
    await nextTick();
    expect(wrapper.text()).toContain("Out of date");
    expect(wrapper.text()).not.toContain("Gmail clips");
  });

  it("uses the lint locale for the clipping issue", async () => {
    const wrapper = mountPanel([], vi.fn(), {
      renderHtml: async () => "x".repeat(92_161),
      canRenderHtml: () => true,
      cloud: false,
      options: { locale: "de" },
    });
    await wrapper.find('[data-testid="issue-check-size"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("Gmail schneidet"));
  });

  it("hides size check without a safe provider, in Cloud, or when disabled", () => {
    const options = {};
    const context = {
      renderHtml: vi.fn(async () => "hello"),
      canRenderHtml: () => true,
      cloud: false,
      options,
    };
    expect(
      mountPanel([], vi.fn(), { ...context, canRenderHtml: () => false })
        .find('[data-testid="issue-check-size"]')
        .exists(),
    ).toBe(false);
    expect(
      mountPanel([], vi.fn(), { ...context, cloud: true })
        .find('[data-testid="issue-check-size"]')
        .exists(),
    ).toBe(false);
    expect(
      mountPanel([], vi.fn(), {
        ...context,
        options: { compatibility: false as const },
      })
        .find('[data-testid="issue-check-size"]')
        .exists(),
    ).toBe(false);
    expect(
      mountPanel([], vi.fn(), {
        ...context,
        options: {
          compatibility: { rules: { "compat.gmail-clipping": "off" } },
        },
      })
        .find('[data-testid="issue-check-size"]')
        .exists(),
    ).toBe(false);
  });

  it("shows the render provider error", async () => {
    const wrapper = mountPanel([], vi.fn(), {
      renderHtml: async () => {
        throw new Error("Network unavailable");
      },
      canRenderHtml: () => true,
      cloud: false,
      options: {},
    });
    await wrapper.find('[data-testid="issue-check-size"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain(
      "Network unavailable",
    );
  });
});
