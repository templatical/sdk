import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  createMenuBlock,
  createTableBlock,
  createSectionBlock,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

describe("text-all-caps", () => {
  function lint(html: string) {
    const block = createParagraphBlock({ content: html });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    return lintAccessibility(content).filter(
      (i) => i.ruleId === "text-all-caps",
    );
  }

  it("fires for long all-caps paragraph", () => {
    expect(
      lint("<p>THIS IS A WHOLE LINE THAT SHOUTS ENTIRELY UPPERCASE</p>"),
    ).toHaveLength(1);
  });

  it("does not fire for short caps (under threshold)", () => {
    expect(lint("<p>BUY NOW</p>")).toEqual([]);
  });

  it("does not fire for mixed case", () => {
    expect(
      lint("<p>This is a Mixed-case sentence with enough letters here</p>"),
    ).toEqual([]);
  });
});

describe("text-low-contrast", () => {
  function lintTitle(color: string, bg: string, level: 1 | 2 | 3 | 4 = 2) {
    const block = createTitleBlock({
      content: "<p>Hi</p>",
      color,
      level,
    });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.settings.backgroundColor = bg;
    content.blocks = [block];
    return lintAccessibility(content).filter(
      (i) => i.ruleId === "text-low-contrast",
    );
  }

  it("fires when heading contrast below 4.5 (small heading)", () => {
    expect(lintTitle("#aaaaaa", "#cccccc", 4)).toHaveLength(1);
  });

  it("uses 3:1 threshold for large headings", () => {
    // 4.0 ratio: passes for level=1 (≥18 ⇒ 3:1) but fails for hypothetical small.
    const issues = lintTitle("#767676", "#ffffff", 1);
    expect(issues).toEqual([]);
  });

  it("does not fire when colors are not opaque hex", () => {
    expect(lintTitle("transparent", "#ffffff")).toEqual([]);
  });
});

describe("text-too-small", () => {
  it("fires for menu fontSize < 14", () => {
    const block = createMenuBlock({ fontSize: 12 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "text-too-small",
    );
    expect(issues).toHaveLength(1);
  });

  it("fires for table fontSize < 14", () => {
    const block = createTableBlock({ fontSize: 11, hasHeaderRow: true });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "text-too-small",
    );
    expect(issues).toHaveLength(1);
  });

  it("does not fire at threshold (14)", () => {
    const block = createMenuBlock({ fontSize: 14 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    expect(
      lintAccessibility(content).filter((i) => i.ruleId === "text-too-small"),
    ).toEqual([]);
  });

  it("respects minFontSize threshold override", () => {
    const block = createMenuBlock({ fontSize: 14 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [createSectionBlock({ children: [[block]] })];
    const issues = lintAccessibility(content, {
      thresholds: { minFontSize: 16 },
    }).filter((i) => i.ruleId === "text-too-small");
    expect(issues).toHaveLength(1);
  });
});
