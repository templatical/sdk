import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSectionBlock,
  type Block,
} from "@templatical/types";
import { lintStructure } from "../../src";
import type { LintOptions } from "../../src";

const RULE = "structure.column-widths-ignored";

function hits(blocks: Block[], options: LintOptions = {}) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return lintStructure(content, options).filter((issue) => issue.ruleId === RULE);
}

describe(RULE, () => {
  it("does not fire without columnWidths", () => {
    expect(hits([createSectionBlock({ columns: "3", children: [[], [], []] })])).toEqual(
      [],
    );
  });

  it("does not fire for a usable override", () => {
    expect(
      hits([
        createSectionBlock({
          columns: "3",
          children: [[], [], []],
          columnWidths: [1, 1, 2],
        }),
      ]),
    ).toEqual([]);
  });

  it("explains a length that differs from the column count", () => {
    const section = createSectionBlock({
      columns: "3",
      children: [[], [], []],
      columnWidths: [50, 50],
    });
    const issues = hits([section]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      blockId: section.id,
      severity: "warning",
    });
    expect(issues[0].message).toBe(
      "These column widths don't match the section's column count, so the layout's split is used.",
    );
    expect(issues[0].suggestion).toBe(
      "Give one width per column, or remove the widths.",
    );
  });

  it("explains a value that is not a finite number above 0", () => {
    const section = createSectionBlock({
      columns: "2",
      children: [[], []],
      columnWidths: [0, 1],
    });
    const issues = hits([section]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      "These column widths include a value that isn't a finite number above 0, so the layout's split is used.",
    );
    expect(issues[0].suggestion).toBe(
      "Use a positive number for each column, or remove the widths.",
    );
  });

  it("explains the count in German", () => {
    const issues = hits(
      [
        createSectionBlock({
          columns: "3",
          children: [[], [], []],
          columnWidths: [50, 50],
        }),
      ],
      { locale: "de" },
    );
    expect(issues[0].message).toBe(
      "Diese Spaltenbreiten passen nicht zur Spaltenzahl der Sektion, deshalb gilt die Aufteilung des Layouts.",
    );
    expect(issues[0].suggestion).toBe(
      "Gib eine Breite pro Spalte an oder entferne die Breiten.",
    );
  });
});
