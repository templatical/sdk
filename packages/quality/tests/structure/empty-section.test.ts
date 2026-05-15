import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
} from "@templatical/types";
import { lintStructure } from "../../src";

describe("structure.empty-section", () => {
  it("fires for a section with no columns", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.children = [];
    content.blocks = [section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.empty-section",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].blockId).toBe(section.id);
  });

  it("fires for a section whose columns are all empty", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "2-1";
    section.children = [[], []];
    content.blocks = [section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.empty-section",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(section.id);
  });

  it("does not fire when at least one column has a block", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "2-1";
    section.children = [[createParagraphBlock()], []];
    content.blocks = [section];
    expect(
      lintStructure(content).filter(
        (i) => i.ruleId === "structure.empty-section",
      ),
    ).toEqual([]);
  });

  it("emits a removeBlock fix that removes the section", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.children = [];
    content.blocks = [section];
    const issue = lintStructure(content).find(
      (i) => i.ruleId === "structure.empty-section",
    );
    expect(issue?.fix).toBeDefined();

    const removed: string[] = [];
    issue?.fix?.apply({
      updateBlock: () => {},
      updateSettings: () => {},
      removeBlock: (id: string) => removed.push(id),
    });
    expect(removed).toEqual([section.id]);
  });
});
