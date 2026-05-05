import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createTitleBlock,
  createSectionBlock,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function lint(blocks: Parameters<typeof createDefaultTemplateContent>[0] extends infer _ ? Array<ReturnType<typeof createTitleBlock> | ReturnType<typeof createSectionBlock>> : never) {
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  content.blocks = blocks;
  return lintAccessibility(content);
}

describe("heading-empty", () => {
  it("fires when content has no text", () => {
    const block = createTitleBlock({ content: "<p></p>", level: 2 });
    const issues = lint([block]).filter((i) => i.ruleId === "heading-empty");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("fires when content is whitespace tags", () => {
    const block = createTitleBlock({ content: "<p>   </p>", level: 2 });
    expect(lint([block]).filter((i) => i.ruleId === "heading-empty")).toHaveLength(1);
  });

  it("does not fire when content has text", () => {
    const block = createTitleBlock({ content: "<p>Hello</p>", level: 2 });
    expect(lint([block]).filter((i) => i.ruleId === "heading-empty")).toEqual([]);
  });
});

describe("heading-skip-level", () => {
  it("fires on H1 → H3 jump", () => {
    const h1 = createTitleBlock({ content: "<p>A</p>", level: 1 });
    const h3 = createTitleBlock({ content: "<p>B</p>", level: 3 });
    const issues = lint([h1, h3]).filter(
      (i) => i.ruleId === "heading-skip-level",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(h3.id);
  });

  it("does not fire on H1 → H2", () => {
    const h1 = createTitleBlock({ content: "<p>A</p>", level: 1 });
    const h2 = createTitleBlock({ content: "<p>B</p>", level: 2 });
    expect(
      lint([h1, h2]).filter((i) => i.ruleId === "heading-skip-level"),
    ).toEqual([]);
  });

  it("does not fire when stepping down (H3 → H2)", () => {
    const h2 = createTitleBlock({ content: "<p>A</p>", level: 2 });
    const h3 = createTitleBlock({ content: "<p>B</p>", level: 3 });
    const h2b = createTitleBlock({ content: "<p>C</p>", level: 2 });
    expect(
      lint([h2, h3, h2b]).filter((i) => i.ruleId === "heading-skip-level"),
    ).toEqual([]);
  });

  it("looks through nested sections in document order", () => {
    const h1 = createTitleBlock({ content: "<p>A</p>", level: 1 });
    const h3 = createTitleBlock({ content: "<p>C</p>", level: 3 });
    const section = createSectionBlock({ columns: "1", children: [[h3]] });
    expect(
      lint([h1, section]).filter((i) => i.ruleId === "heading-skip-level"),
    ).toHaveLength(1);
  });
});

describe("heading-multiple-h1", () => {
  it("fires when more than one H1 exists", () => {
    const h1a = createTitleBlock({ content: "<p>A</p>", level: 1 });
    const h1b = createTitleBlock({ content: "<p>B</p>", level: 1 });
    const issues = lint([h1a, h1b]).filter(
      (i) => i.ruleId === "heading-multiple-h1",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(h1b.id);
  });

  it("does not fire on single H1", () => {
    const h1 = createTitleBlock({ content: "<p>A</p>", level: 1 });
    expect(
      lint([h1]).filter((i) => i.ruleId === "heading-multiple-h1"),
    ).toEqual([]);
  });
});
