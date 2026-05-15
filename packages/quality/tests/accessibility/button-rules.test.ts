import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function lintButton(
  overrides: Partial<Parameters<typeof createButtonBlock>[0]>,
  ruleId: string,
  opts?: Parameters<typeof lintAccessibility>[1],
) {
  const block = createButtonBlock({
    text: "Buy ticket",
    url: "/x",
    ...overrides,
  } as Parameters<typeof createButtonBlock>[0]);
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  content.blocks = [block];
  return lintAccessibility(content, opts).filter((i) => i.ruleId === ruleId);
}

describe("a11y.button-vague-label", () => {
  it("fires for 'Click here'", () => {
    expect(
      lintButton({ text: "Click here" }, "a11y.button-vague-label"),
    ).toHaveLength(1);
  });

  it("fires for 'Submit'", () => {
    expect(lintButton({ text: "Submit" }, "a11y.button-vague-label")).toHaveLength(
      1,
    );
  });

  it("does not fire for descriptive label", () => {
    expect(
      lintButton({ text: "Buy spring tickets" }, "a11y.button-vague-label"),
    ).toEqual([]);
  });

  it("uses German dictionary when locale=de", () => {
    expect(
      lintButton({ text: "Senden" }, "a11y.button-vague-label", { locale: "de" }),
    ).toHaveLength(1);
  });

  it("fires for label with trailing exclamation", () => {
    expect(
      lintButton({ text: "Click here!" }, "a11y.button-vague-label"),
    ).toHaveLength(1);
  });

  it("fires for label with leading arrow", () => {
    expect(
      lintButton({ text: "→ Submit" }, "a11y.button-vague-label"),
    ).toHaveLength(1);
  });

  it("fires for label with surrounding whitespace and punctuation", () => {
    expect(
      lintButton({ text: "  »OK«  " }, "a11y.button-vague-label"),
    ).toHaveLength(1);
  });

  it("does not fire when surrounding text adds real content", () => {
    expect(
      lintButton({ text: "Submit your order" }, "a11y.button-vague-label"),
    ).toEqual([]);
  });
});

describe("a11y.button-touch-target", () => {
  it("fires when estimated height < 44", () => {
    expect(
      lintButton(
        {
          fontSize: 12,
          buttonPadding: { top: 4, right: 12, bottom: 4, left: 12 },
        },
        "a11y.button-touch-target",
      ),
    ).toHaveLength(1);
  });

  it("does not fire when estimated height >= 44", () => {
    expect(
      lintButton(
        {
          fontSize: 16,
          buttonPadding: { top: 12, right: 24, bottom: 12, left: 24 },
        },
        "a11y.button-touch-target",
      ),
    ).toEqual([]);
  });
});
