import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import { lintStructure } from "../../src";

describe("structure.section-column-mismatch", () => {
  it("does not fire when children.length matches the layout (1 column)", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "1";
    section.children = [[]];
    content.blocks = [section];
    expect(
      lintStructure(content).filter(
        (i) => i.ruleId === "structure.section-column-mismatch",
      ),
    ).toEqual([]);
  });

  it("does not fire for 2-column layouts with 2 children arrays", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "2-1";
    section.children = [[], []];
    content.blocks = [section];
    expect(
      lintStructure(content).filter(
        (i) => i.ruleId === "structure.section-column-mismatch",
      ),
    ).toEqual([]);
  });

  it("fires when 2-1 layout has only 1 children array", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "2-1";
    section.children = [[]];
    content.blocks = [section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.section-column-mismatch",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].blockId).toBe(section.id);
    expect(issues[0].message).toContain("2-1");
    expect(issues[0].message).toContain("2");
    expect(issues[0].message).toContain("1");
  });

  it("fires when 3-column layout has 2 children arrays", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "3";
    section.children = [[], []];
    content.blocks = [section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.section-column-mismatch",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(section.id);
  });

  it("fires when 1-column layout has 2 children arrays", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    section.columns = "1";
    section.children = [[], []];
    content.blocks = [section];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.section-column-mismatch",
    );
    expect(issues).toHaveLength(1);
  });
});
