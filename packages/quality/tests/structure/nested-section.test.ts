import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import { lintStructure } from "../../src";

describe("structure.nested-section", () => {
  it("does not fire when sections are at the root only", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createSectionBlock(), createSectionBlock()];
    expect(
      lintStructure(content).filter(
        (i) => i.ruleId === "structure.nested-section",
      ),
    ).toEqual([]);
  });

  it("fires when a section sits inside another section's column", () => {
    const content = createDefaultTemplateContent();
    const inner = createSectionBlock();
    const outer = createSectionBlock();
    outer.children = [[inner]];
    content.blocks = [outer];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.nested-section",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].blockId).toBe(inner.id);
  });

  it("fires for each nested level", () => {
    const content = createDefaultTemplateContent();
    const deepest = createSectionBlock();
    const middle = createSectionBlock();
    middle.children = [[deepest]];
    const top = createSectionBlock();
    top.children = [[middle]];
    content.blocks = [top];
    const issues = lintStructure(content).filter(
      (i) => i.ruleId === "structure.nested-section",
    );
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.blockId).sort()).toEqual(
      [middle.id, deepest.id].sort(),
    );
  });
});
