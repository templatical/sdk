import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
} from "@templatical/types";
import { lintStructure } from "../../src";

describe("structure.duplicate-block-id", () => {
  it("does not fire when all ids are unique", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createTitleBlock(),
      createParagraphBlock(),
      createSectionBlock(),
    ];
    const issues = lintStructure(content);
    expect(issues.filter((i) => i.ruleId === "structure.duplicate-block-id"))
      .toEqual([]);
  });

  it("fires once per duplicated id at root level", () => {
    const content = createDefaultTemplateContent();
    const a = createTitleBlock();
    const b = createParagraphBlock();
    b.id = a.id;
    content.blocks = [a, b];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.duplicate-block-id",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].blockId).toBe(a.id);
  });

  it("fires when duplicate is inside a section column", () => {
    const content = createDefaultTemplateContent();
    const outer = createParagraphBlock();
    const inner = createParagraphBlock();
    inner.id = outer.id;
    const section = createSectionBlock();
    section.children = [[inner]];
    content.blocks = [outer, section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.duplicate-block-id",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].params).toBeUndefined();
    expect(issues[0].message).toContain("2 times");
  });

  it("interpolates the count for higher duplications", () => {
    const content = createDefaultTemplateContent();
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const c = createParagraphBlock();
    b.id = a.id;
    c.id = a.id;
    content.blocks = [a, b, c];
    const issue = lintStructure(content).find(
      (i) => i.ruleId === "structure.duplicate-block-id",
    );
    expect(issue?.message).toContain("3 times");
  });

  it("respects severity override and disable flag", () => {
    const content = createDefaultTemplateContent();
    const a = createTitleBlock();
    const b = createTitleBlock();
    b.id = a.id;
    content.blocks = [a, b];

    const warned = lintStructure(content, {
      rules: { "structure.duplicate-block-id": "warning" },
    }).find((i) => i.ruleId === "structure.duplicate-block-id");
    expect(warned?.severity).toBe("warning");

    const off = lintStructure(content, {
      rules: { "structure.duplicate-block-id": "off" },
    }).filter((i) => i.ruleId === "structure.duplicate-block-id");
    expect(off).toEqual([]);

    expect(lintStructure(content, { disabled: true })).toEqual([]);
  });
});
