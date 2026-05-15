import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
} from "@templatical/types";
import { lintStructure } from "../../src";

describe("structure.empty-column", () => {
  it("does not fire for single-column sections (the section is the unit)", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "1";
    section.children = [[]];
    content.blocks = [section];
    expect(
      lintStructure(content).filter(
        (i) => i.ruleId === "structure.empty-column",
      ),
    ).toEqual([]);
  });

  it("fires for an empty column inside a 2-column section", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "2";
    section.children = [[createParagraphBlock()], []];
    content.blocks = [section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.empty-column",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].blockId).toBe(section.id);
    expect(issues[0].message).toContain("2");
  });

  it("fires once per empty column in a 3-column section", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "3";
    section.children = [[createParagraphBlock()], [], []];
    content.blocks = [section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.empty-column",
    );
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.blockId === section.id)).toBe(true);
  });

  it("does not fire when every column has content", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "2";
    section.children = [[createParagraphBlock()], [createParagraphBlock()]];
    content.blocks = [section];
    expect(
      lintStructure(content).filter(
        (i) => i.ruleId === "structure.empty-column",
      ),
    ).toEqual([]);
  });

  it("does not emit an auto-fix (layout change is not trivial)", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "2";
    section.children = [[createParagraphBlock()], []];
    content.blocks = [section];
    const issue = lintStructure(content).find(
      (i) => i.ruleId === "structure.empty-column",
    );
    expect(issue?.fix).toBeUndefined();
  });
});
