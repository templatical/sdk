import { describe, expect, it } from "vitest";
import {
  createButtonBlock, createCountdownBlock, createCustomBlock, createDefaultTemplateContent,
  createHtmlBlock, createImageBlock, createMenuBlock, createParagraphBlock,
  createSectionBlock, createTableBlock, createTitleBlock, createVideoBlock,
} from "@templatical/types";
import { lintDeliverability } from "../../src";

const id = "deliverability.low-text";
const image = () => createImageBlock({ src: "https://example.com/image.png" });
const message = (count: number, min = 200) =>
  `This email has images but only ${count} characters of text (under ${min}). Some spam filters score image-heavy emails with little text, and readers who block images see almost nothing. Add text that carries the message.`;
function check(blocks: ReturnType<typeof createDefaultTemplateContent>["blocks"], options = {}) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return lintDeliverability(content, options).filter((issue) => issue.ruleId === id);
}

describe(id, () => {
  it("fires below 200 visible characters with the exact template-level issue", () => {
    expect(check([image(), createParagraphBlock({ content: `<p>${"x".repeat(199)}</p>` })])).toEqual([{
      blockId: null, ruleId: id, severity: "info",
      message: "This email has images but only 199 characters of text (under 200). Some spam filters score image-heavy emails with little text, and readers who block images see almost nothing. Add text that carries the message.",
      fix: undefined,
    }]);
  });

  it("passes at exactly 200 characters", () => {
    expect(check([image(), createParagraphBlock({ content: "x".repeat(200) })])).toEqual([]);
  });

  it("requires an image-producing block with a nonempty source when it is an image", () => {
    expect(check([createParagraphBlock({ content: "short" })])).toEqual([]);
    expect(check([createImageBlock({ src: "" })])).toEqual([]);
    expect(check([createVideoBlock()]).map(({ ruleId, severity, blockId }) => ({ ruleId, severity, blockId }))).toEqual([
      { ruleId: id, severity: "info", blockId: null },
    ]);
    expect(check([createCountdownBlock()]).map(({ ruleId, severity, blockId }) => ({ ruleId, severity, blockId }))).toEqual([
      { ruleId: id, severity: "info", blockId: null },
    ]);
  });

  it("suppresses when custom HTML may carry text, including nested custom blocks", () => {
    const custom = createCustomBlock({ type: "x", name: "X", fields: [], template: "<p>message</p>" });
    expect(check([image(), custom])).toEqual([]);
    const section = createSectionBlock({ children: [[custom]] });
    expect(check([image(), section])).toEqual([]);
  });

  it("counts title, paragraph, HTML, table cell, button and menu item text", () => {
    const menu = createMenuBlock({ items: [{ id: "m", text: "F", url: "https://example.com", openInNewTab: false, bold: false, underline: false }] });
    const blocks = [image(),
      createTitleBlock({ content: "<h1>A</h1>" }),
      createParagraphBlock({ content: "<p>B</p>" }),
      createHtmlBlock({ content: "<div>C</div>" }),
      createTableBlock({ rows: [{ id: "r", cells: [{ id: "c", content: "<span>D</span>" }] }] }),
      createButtonBlock({ text: "E" }), menu,
    ];
    expect(check(blocks).map((issue) => issue.message)).toEqual([message(11)]);
  });

  it("counts merge tags as written and descends into section text", () => {
    const section = createSectionBlock({ children: [[createParagraphBlock({ content: "{{first_name}}" })]] });
    expect(check([image(), section]).map((issue) => issue.message)).toEqual([message(14)]);
  });

  it("honors a configured threshold boundary", () => {
    const blocks = [image(), createParagraphBlock({ content: "x".repeat(49) })];
    expect(check(blocks, { deliverability: { thresholds: { minTextLength: 50 } } }).map((issue) => issue.message))
      .toEqual([message(49, 50)]);
    expect(check([image(), createParagraphBlock({ content: "x".repeat(50) })], { deliverability: { thresholds: { minTextLength: 50 } } })).toEqual([]);
  });

  it("respects severity and category switches", () => {
    const blocks = [image()];
    expect(check(blocks, { deliverability: { rules: { [id]: "warning" } } })[0].severity).toBe("warning");
    expect(check(blocks, { deliverability: { rules: { [id]: "off" } } })).toEqual([]);
    expect(check(blocks, { deliverability: false })).toEqual([]);
    expect(check(blocks, { disabled: true })).toEqual([]);
  });
});
