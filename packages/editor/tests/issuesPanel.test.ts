// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import IssuesPanel from "../src/components/sidebar/IssuesPanel.vue";
import {
  TEMPLATE_LINT_KEY,
  EDITOR_KEY,
  TRANSLATIONS_KEY,
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
  },
} as never;

function mountPanel(issues: LintIssue[], applyFix = vi.fn()) {
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
        [EDITOR_KEY as symbol]: { selectBlock },
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
      },
    ];
    const wrapper = mountPanel(issues);

    await wrapper.find("button[data-testid=\"issue-jump\"]").trigger("click");

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
        fix: { description: "Remove", apply },
      },
      {
        blockId: "b2",
        ruleId: "a11y.heading-skip-level",
        severity: "error",
        message: "Skipped a level.",
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
      },
      {
        blockId: "b2",
        ruleId: "x.err",
        severity: "error",
        message: "err-msg",
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
      },
      {
        blockId: "b2",
        ruleId: "a.y",
        severity: "warning",
        message: "m2",
      },
    ];
    const wrapper = mountPanel(issues);
    expect(wrapper.find('[title*="2 issue"]').exists()).toBe(true);
  });
});
