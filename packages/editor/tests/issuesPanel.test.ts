// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import IssuesPanel from "../src/components/sidebar/IssuesPanel.vue";
import {
  TEMPLATE_LINT_KEY,
  EDITOR_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import type { LintIssue } from "../src/composables/useTemplateLint";

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
        [EDITOR_KEY as symbol]: { selectBlock: vi.fn() },
        [TRANSLATIONS_KEY as symbol]: translationsStub,
      },
    },
  });
}

describe("IssuesPanel", () => {
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
