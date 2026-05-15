// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import BlockIssueBadge from "../src/components/canvas/BlockIssueBadge.vue";
import { TEMPLATE_LINT_KEY, TRANSLATIONS_KEY } from "../src/keys";
import type { LintIssue } from "../src/composables/useTemplateLint";

const translationsStub = {
  issues: {
    badgeError: "Has errors",
    badgeWarning: "Has warnings",
  },
} as never;

function mountBadge(blockId: string, issues: LintIssue[]) {
  return mount(BlockIssueBadge, {
    props: { blockId },
    global: {
      provide: {
        [TEMPLATE_LINT_KEY as symbol]: {
          issues: ref(issues),
          ready: ref(true),
          unavailable: ref(false),
          applyFix: vi.fn(),
          destroy: () => {},
        },
        [TRANSLATIONS_KEY as symbol]: translationsStub,
      },
    },
  });
}

describe("BlockIssueBadge", () => {
  it("renders nothing when the block has no issues", () => {
    const wrapper = mountBadge("b1", []);
    expect(wrapper.find("span").exists()).toBe(false);
  });

  it("renders nothing when issues exist but for a different block", () => {
    const wrapper = mountBadge("b1", [
      {
        blockId: "other",
        ruleId: "a.x",
        severity: "error",
        message: "m",
      },
    ]);
    expect(wrapper.find("span").exists()).toBe(false);
  });

  it("renders an error badge when block has an error-severity issue", () => {
    const wrapper = mountBadge("b1", [
      {
        blockId: "b1",
        ruleId: "a.x",
        severity: "error",
        message: "m",
      },
    ]);
    const badge = wrapper.find("span");
    expect(badge.exists()).toBe(true);
    expect(badge.attributes("title")).toBe("Has errors");
  });

  it("renders a warning badge when block has only warning-severity issues", () => {
    const wrapper = mountBadge("b1", [
      {
        blockId: "b1",
        ruleId: "a.x",
        severity: "warning",
        message: "m",
      },
    ]);
    const badge = wrapper.find("span");
    expect(badge.exists()).toBe(true);
    expect(badge.attributes("title")).toBe("Has warnings");
  });

  it("prefers error over warning when both are present", () => {
    const wrapper = mountBadge("b1", [
      {
        blockId: "b1",
        ruleId: "a.x",
        severity: "warning",
        message: "m1",
      },
      {
        blockId: "b1",
        ruleId: "a.y",
        severity: "error",
        message: "m2",
      },
    ]);
    expect(wrapper.find("span").attributes("title")).toBe("Has errors");
  });

  it("ignores info-only issues", () => {
    const wrapper = mountBadge("b1", [
      {
        blockId: "b1",
        ruleId: "a.x",
        severity: "info",
        message: "m",
      },
    ]);
    expect(wrapper.find("span").exists()).toBe(false);
  });
});
