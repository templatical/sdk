import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  applyOperations,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  type Operation,
} from "../../../packages/types/src/index";
import { validateTemplate } from "../../../packages/template-tools/src/validate";

it("EN and DE operation examples are identical and each intermediate template validates", () => {
  const read = (rel: string) =>
    readFileSync(join(import.meta.dirname, "..", rel), "utf8");
  const extract = (src: string): Operation[] => {
    const body = src.match(/```json\n([\s\S]*?)```/)?.[1];
    expect(body?.includes("...")).toBe(false);
    return body!
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  };
  const en = extract(read("api/operations.md"));
  expect(extract(read("de/api/operations.md"))).toEqual(en);
  expect(en.map((op) => op.op)).toEqual([
    "addBlock",
    "moveBlock",
    "deleteBlock",
    "updateBlock",
    "updateSettings",
    "setContent",
  ]);
  let content = createDefaultTemplateContent();
  content.settings.preheaderText = "Original preheader";
  content.blocks = [
    createParagraphBlock({
      id: "b1",
      content: "<p>Original</p>",
      visibility: { desktop: true, mobile: false },
    }),
    createSectionBlock({ id: "s1", columns: "1", children: [[]] }),
  ];
  expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  for (const op of en) {
    content = applyOperations(content, [op]);
    expect
      .soft(validateTemplate(content), op.op)
      .toEqual({ valid: true, errors: [] });
    switch (op.op) {
      case "addBlock":
        expect(content.blocks.map((b) => b.id)).toEqual(["b1", "b2", "s1"]);
        break;
      case "moveBlock":
        expect(content.blocks.map((b) => b.id)).toEqual(["b1", "s1"]);
        expect(content.blocks[1]).toMatchObject({
          children: [[{ id: "b2", content: "<p>Hi</p>" }]],
        });
        break;
      case "deleteBlock":
        expect(content.blocks[1]).toMatchObject({ children: [[]] });
        break;
      case "updateBlock":
        expect(content.blocks[0]).toMatchObject({ content: "<p>Hello</p>" });
        expect(content.blocks[0]).not.toHaveProperty("visibility");
        break;
      case "updateSettings":
        expect(content.settings.width).toBe(640);
        expect.soft(content.settings).not.toHaveProperty("preheaderText");
        break;
      case "setContent":
        expect(content).toEqual({
          blocks: [],
          settings: {
            width: 600,
            backgroundColor: "#ffffff",
            textColor: "#1a1a1a",
            linkUnderline: true,
            fontFamily: "Arial",
            locale: "en",
          },
        });
        break;
    }
  }
});
