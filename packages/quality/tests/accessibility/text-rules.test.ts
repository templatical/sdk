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

describe("a11y.text-all-caps", () => {
  function lint(html: string) {
    const block = createParagraphBlock({ content: html });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    return lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-all-caps",
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

  it("fires for long all-caps Cyrillic paragraph", () => {
    expect(
      lint("<p>СКИДКА ПЯТЬДЕСЯТ ПРОЦЕНТОВ ТОЛЬКО СЕГОДНЯ СПЕШИТЕ КУПИТЬ</p>"),
    ).toHaveLength(1);
  });

  it("fires for long all-caps Greek paragraph", () => {
    expect(
      lint(
        "<p>ΜΕΓΑΛΗ ΠΡΟΣΦΟΡΑ ΣΗΜΕΡΑ ΜΟΝΟ ΑΓΟΡΑΣΤΕ ΤΩΡΑ ΧΩΡΙΣ ΚΑΘΥΣΤΕΡΗΣΗ</p>",
      ),
    ).toHaveLength(1);
  });

  it("does not fire for mixed-case Cyrillic", () => {
    expect(
      lint("<p>Это обычное предложение со смешанным регистром букв</p>"),
    ).toEqual([]);
  });
});

describe("a11y.text-justified", () => {
  function build(html: string) {
    const block = createParagraphBlock({ content: html });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    return { block, content };
  }

  function lint(html: string) {
    const { content } = build(html);
    return lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-justified",
    );
  }

  /** Runs the rule's fix and returns the rewritten paragraph HTML. */
  function applyFix(html: string): string {
    const { block, content } = build(html);
    const issue = lintAccessibility(content).find(
      (i) => i.ruleId === "a11y.text-justified",
    );
    if (issue?.fix === undefined) {
      throw new Error("expected a fixable a11y.text-justified issue");
    }
    let patched = block.content;
    issue.fix.apply({
      updateBlock: (_id, patch) => {
        patched = (patch as { content: string }).content;
      },
      updateSettings: () => {},
      removeBlock: () => {},
    });
    return patched;
  }

  it("fires for a justified paragraph", () => {
    const issues = lint('<p style="text-align: justify">Body copy.</p>');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("Justified text");
  });

  it("does not fire for left, center or right", () => {
    for (const align of ["left", "center", "right"]) {
      expect(lint(`<p style="text-align: ${align}">Body copy.</p>`)).toEqual([]);
    }
  });

  it("does not fire for an unaligned paragraph", () => {
    expect(lint("<p>Body copy.</p>")).toEqual([]);
  });

  // `justify-content` is common in hand-written flexbox markup (three of the
  // playground's showcase templates carry one). A rule matching the bare
  // token `justify` would flag every one of them.
  it("does not fire for justify-content", () => {
    expect(
      lint('<p style="display: flex; justify-content: center">Body.</p>'),
    ).toEqual([]);
  });

  it("tolerates casing and whitespace variants from imported markup", () => {
    expect(lint('<p style="TEXT-ALIGN : JUSTIFY">Body.</p>')).toHaveLength(1);
    expect(lint("<p style='text-align:justify;'>Body.</p>")).toHaveLength(1);
  });

  it("fires for a paragraph nested in a section column", () => {
    const paragraph = createParagraphBlock({
      content: '<p style="text-align: justify">Body.</p>',
    });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [createSectionBlock({ children: [[paragraph]] })];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-justified",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(paragraph.id);
  });

  it("fix removes the style attribute when text-align was its only declaration", () => {
    expect(applyFix('<p style="text-align: justify">Body copy.</p>')).toBe(
      "<p>Body copy.</p>",
    );
  });

  // TipTap merges every extension's renderHTML into one `style` attribute,
  // so dropping the attribute wholesale would discard the line height.
  it("fix preserves sibling declarations", () => {
    expect(
      applyFix(
        '<p style="text-align: justify; line-height: 1.8">Body copy.</p>',
      ),
    ).toBe('<p style="line-height: 1.8">Body copy.</p>');
  });

  it("fix unsets rather than forcing left, so the paragraph inherits", () => {
    expect(applyFix('<p style="text-align: justify">Body.</p>')).not.toContain(
      "text-align",
    );
  });

  it("fix leaves a non-justified sibling paragraph untouched", () => {
    expect(
      applyFix(
        '<p style="text-align: justify">One.</p><p style="text-align: center">Two.</p>',
      ),
    ).toBe('<p>One.</p><p style="text-align: center">Two.</p>');
  });

  it("respects a severity override", () => {
    const { content } = build('<p style="text-align: justify">Body.</p>');
    const issues = lintAccessibility(content, {
      accessibility: { rules: { "a11y.text-justified": "error" } },
    }).filter((i) => i.ruleId === "a11y.text-justified");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("can be turned off", () => {
    const { content } = build('<p style="text-align: justify">Body.</p>');
    expect(
      lintAccessibility(content, {
        accessibility: { rules: { "a11y.text-justified": "off" } },
      }).filter((i) => i.ruleId === "a11y.text-justified"),
    ).toEqual([]);
  });
});

describe("a11y.text-low-contrast", () => {
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
      (i) => i.ruleId === "a11y.text-low-contrast",
    );
  }

  it("fires when heading contrast below 4.5 (small heading)", () => {
    expect(lintTitle("#aaaaaa", "#cccccc", 4)).toHaveLength(1);
  });

  it("uses 3:1 threshold for H1 (36px ≥ 24px = WCAG large)", () => {
    // #888888 on white ≈ 3.5:1 — passes 3:1 but fails 4.5:1.
    expect(lintTitle("#888888", "#ffffff", 1)).toEqual([]);
  });

  it("uses 3:1 threshold for H2 (28px ≥ 24px = WCAG large)", () => {
    expect(lintTitle("#888888", "#ffffff", 2)).toEqual([]);
  });

  it("uses 4.5:1 threshold for H3 (22px < 24px, not WCAG large)", () => {
    // Same 3.5:1 color pair fails strict 4.5:1 requirement for H3.
    const issues = lintTitle("#888888", "#ffffff", 3);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/4\.5:1/);
  });

  it("uses 4.5:1 threshold for H4 (18px < 24px, not WCAG large)", () => {
    // Previously passed (18px ≥ 18 → relaxed 3:1); now fails strict.
    const issues = lintTitle("#888888", "#ffffff", 4);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/4\.5:1/);
  });

  it("does not fire when colors are not opaque hex", () => {
    expect(lintTitle("transparent", "#ffffff")).toEqual([]);
  });

  it("resolves against the title's own backgroundColor (block bg wins over template bg)", () => {
    // Template bg is white, but the title sets its own black bg. Near-black
    // text on black-bg should fire even though near-black on white would pass.
    const block = createTitleBlock({
      content: "<p>Hi</p>",
      color: "#0a0a0a",
      level: 3,
      styles: {
        backgroundColor: "#000000",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.settings.backgroundColor = "#ffffff";
    content.blocks = [block];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-low-contrast",
    );
    expect(issues).toHaveLength(1);
  });

  it("flags a colorless title using the inherited document textColor", () => {
    // The title sets no color, so it inherits the document textColor. A
    // low-contrast document color must still be flagged (H3 = strict 4.5:1).
    const block = createTitleBlock({ content: "<p>Hi</p>", level: 3 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.settings.backgroundColor = "#ffffff";
    content.settings.textColor = "#888888"; // ≈3.5:1 on white → fails 4.5:1
    content.blocks = [block];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-low-contrast",
    );
    expect(issues).toHaveLength(1);
  });

  it("does not flag a colorless title when the inherited document textColor contrasts", () => {
    const block = createTitleBlock({ content: "<p>Hi</p>", level: 3 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.settings.backgroundColor = "#ffffff";
    content.settings.textColor = "#000000"; // black on white → passes
    content.blocks = [block];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-low-contrast",
    );
    expect(issues).toEqual([]);
  });
});

describe("a11y.text-too-small", () => {
  it("fires for menu fontSize < 14", () => {
    const block = createMenuBlock({ fontSize: 12 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-too-small",
    );
    expect(issues).toHaveLength(1);
  });

  it("fires for table fontSize < 14", () => {
    const block = createTableBlock({ fontSize: 11, hasHeaderRow: true });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "a11y.text-too-small",
    );
    expect(issues).toHaveLength(1);
  });

  it("does not fire at threshold (14)", () => {
    const block = createMenuBlock({ fontSize: 14 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    expect(
      lintAccessibility(content).filter(
        (i) => i.ruleId === "a11y.text-too-small",
      ),
    ).toEqual([]);
  });

  it("respects minFontSize threshold override", () => {
    const block = createMenuBlock({ fontSize: 14 });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [createSectionBlock({ children: [[block]] })];
    const issues = lintAccessibility(content, {
      accessibility: { thresholds: { minFontSize: 16 } },
    }).filter((i) => i.ruleId === "a11y.text-too-small");
    expect(issues).toHaveLength(1);
  });
});
