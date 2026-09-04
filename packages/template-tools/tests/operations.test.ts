import { describe, expect, it } from "vitest";
import type { TemplateOperation, TemplateContent } from "@templatical/types";
import { applyOperation, getColumnCount } from "../src/operations";
import { validateTemplate } from "../src/validate";

const padding = { top: 8, right: 8, bottom: 8, left: 8 };

function title(id: string, content = "Hi") {
  return {
    id,
    type: "title" as const,
    content,
    level: 1 as const,
    textAlign: "left" as const,
    styles: { padding },
  };
}

function paragraph(id: string, content = "Body") {
  return { id, type: "paragraph" as const, content, styles: { padding } };
}

function section(id: string, columns: "1" | "2" | "3", children: unknown[][]) {
  return { id, type: "section" as const, columns, children, styles: { padding } };
}

function doc(blocks: unknown[]): TemplateContent {
  return {
    blocks,
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      textColor: "#111111",
      fontFamily: "Arial, sans-serif",
      linkUnderline: true,
      locale: "en",
    },
  } as unknown as TemplateContent;
}

function op(operation: TemplateOperation, data: Record<string, unknown>) {
  return { operation, data, timestamp: 0 };
}

describe("getColumnCount", () => {
  it("maps every layout the block model allows", () => {
    expect(getColumnCount("1")).toBe(1);
    expect(getColumnCount("2")).toBe(2);
    expect(getColumnCount("3")).toBe(3);
    expect(getColumnCount("2-1")).toBe(2);
    expect(getColumnCount("1-2")).toBe(2);
  });
});

describe("purity", () => {
  it("never mutates the input document on success", () => {
    const before = doc([title("t1")]);
    const snapshot = JSON.stringify(before);
    const result = applyOperation(before, op("add_block", { block: title("t2") }));

    expect(result.ok).toBe(true);
    expect(result.content.blocks).toHaveLength(2);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("returns the original document untouched on failure", () => {
    const before = doc([title("t1")]);
    const result = applyOperation(before, op("delete_block", { blockId: "nope" }));

    expect(result.ok).toBe(false);
    expect(result.content).toBe(before);
  });

  it("deep-clones an added block so later edits cannot reach back", () => {
    const block = title("t2");
    const result = applyOperation(doc([]), op("add_block", { block }));
    block.content = "mutated after the call";
    expect((result.content.blocks[0] as typeof block).content).toBe("Hi");
  });
});

describe("add_block", () => {
  it("appends at the top level by default", () => {
    const r = applyOperation(doc([title("t1")]), op("add_block", { block: paragraph("p1") }));
    expect(r.content.blocks.map((b) => b.id)).toEqual(["t1", "p1"]);
  });

  it("inserts at an explicit index", () => {
    const r = applyOperation(
      doc([title("t1"), title("t2")]),
      op("add_block", { block: paragraph("p1"), index: 1 }),
    );
    expect(r.content.blocks.map((b) => b.id)).toEqual(["t1", "p1", "t2"]);
  });

  it("appends when the index is past the end", () => {
    const r = applyOperation(
      doc([title("t1")]),
      op("add_block", { block: paragraph("p1"), index: 99 }),
    );
    expect(r.content.blocks.map((b) => b.id)).toEqual(["t1", "p1"]);
  });

  it("adds into a section column", () => {
    const r = applyOperation(
      doc([section("s1", "2", [[], []])]),
      op("add_block", {
        block: paragraph("p1"),
        targetSectionId: "s1",
        columnIndex: 1,
      }),
    );
    const s = r.content.blocks[0] as unknown as { children: { id: string }[][] };
    expect(s.children[0]).toEqual([]);
    expect(s.children[1].map((b) => b.id)).toEqual(["p1"]);
  });

  it("rejects a duplicate id", () => {
    const r = applyOperation(doc([title("t1")]), op("add_block", { block: title("t1") }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('id "t1" already exists');
  });

  it("rejects a missing block", () => {
    const r = applyOperation(doc([]), op("add_block", {}));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("needs a `block`");
  });

  it("rejects an out-of-range column", () => {
    const r = applyOperation(
      doc([section("s1", "2", [[], []])]),
      op("add_block", { block: paragraph("p1"), targetSectionId: "s1", columnIndex: 5 }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("out of range");
  });

  it("rejects targeting a non-section block", () => {
    const r = applyOperation(
      doc([title("t1")]),
      op("add_block", { block: paragraph("p1"), targetSectionId: "t1" }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("not a section");
  });

  it("rejects an unknown target section", () => {
    const r = applyOperation(
      doc([]),
      op("add_block", { block: paragraph("p1"), targetSectionId: "ghost" }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('No block with id "ghost"');
  });
});

describe("update_block", () => {
  it("merges updates into the block", () => {
    const r = applyOperation(
      doc([title("t1", "Before")]),
      op("update_block", { blockId: "t1", updates: { content: "After" } }),
    );
    expect((r.content.blocks[0] as { content: string }).content).toBe("After");
    expect((r.content.blocks[0] as { level: number }).level).toBe(1);
  });

  it("reaches a block nested in a section column", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[title("t1", "Before")]])]),
      op("update_block", { blockId: "t1", updates: { content: "After" } }),
    );
    const s = r.content.blocks[0] as unknown as { children: { content: string }[][] };
    expect(s.children[0][0].content).toBe("After");
  });

  it("refuses to change a block's type", () => {
    const r = applyOperation(
      doc([title("t1")]),
      op("update_block", { blockId: "t1", updates: { type: "paragraph" } }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Cannot change a block's type");
  });

  it("rejects an unknown block", () => {
    const r = applyOperation(
      doc([]),
      op("update_block", { blockId: "ghost", updates: { content: "x" } }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('No block with id "ghost"');
  });
});

describe("update_block_style", () => {
  it("merges styles instead of replacing them", () => {
    const r = applyOperation(
      doc([title("t1")]),
      op("update_block_style", {
        blockId: "t1",
        styles: { backgroundColor: "#eeeeee" },
      }),
    );
    const styles = (r.content.blocks[0] as { styles: Record<string, unknown> }).styles;
    expect(styles.backgroundColor).toBe("#eeeeee");
    expect(styles.padding).toEqual(padding);
  });

  it("rejects a missing styles object", () => {
    const r = applyOperation(doc([title("t1")]), op("update_block_style", { blockId: "t1" }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("needs a `styles`");
  });
});

describe("delete_block", () => {
  it("removes a top-level block", () => {
    const r = applyOperation(
      doc([title("t1"), title("t2")]),
      op("delete_block", { blockId: "t1" }),
    );
    expect(r.content.blocks.map((b) => b.id)).toEqual(["t2"]);
  });

  it("removes a block from inside a section column", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[title("t1"), paragraph("p1")]])]),
      op("delete_block", { blockId: "t1" }),
    );
    const s = r.content.blocks[0] as unknown as { children: { id: string }[][] };
    expect(s.children[0].map((b) => b.id)).toEqual(["p1"]);
  });

  it("removes a section together with its children", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[title("t1")]]), title("t2")]),
      op("delete_block", { blockId: "s1" }),
    );
    expect(r.content.blocks.map((b) => b.id)).toEqual(["t2"]);
  });
});

describe("move_block", () => {
  it("reorders within the top level", () => {
    const r = applyOperation(
      doc([title("t1"), title("t2"), title("t3")]),
      op("move_block", { blockId: "t3", index: 0 }),
    );
    expect(r.content.blocks.map((b) => b.id)).toEqual(["t3", "t1", "t2"]);
  });

  it("moves a top-level block into a section column", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[]]), paragraph("p1")]),
      op("move_block", { blockId: "p1", index: 0, targetSectionId: "s1" }),
    );
    expect(r.content.blocks.map((b) => b.id)).toEqual(["s1"]);
    const s = r.content.blocks[0] as unknown as { children: { id: string }[][] };
    expect(s.children[0].map((b) => b.id)).toEqual(["p1"]);
  });

  it("moves a block out of a column back to the top level", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[paragraph("p1")]])]),
      op("move_block", { blockId: "p1", index: 0 }),
    );
    expect(r.content.blocks.map((b) => b.id)).toEqual(["p1", "s1"]);
  });

  it("rejects a negative or missing index", () => {
    const base = doc([title("t1")]);
    expect(applyOperation(base, op("move_block", { blockId: "t1" })).ok).toBe(false);
    expect(applyOperation(base, op("move_block", { blockId: "t1", index: -1 })).ok).toBe(
      false,
    );
  });

  it("rejects moving a block into itself", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[]])]),
      op("move_block", { blockId: "s1", index: 0, targetSectionId: "s1" }),
    );
    expect(r.ok).toBe(false);
  });

  it("does not strand the block when the target is invalid", () => {
    // Core resolves the target before splicing the source for exactly this
    // reason; a naive implementation removes the block and then fails.
    const before = doc([section("s1", "2", [[], []]), paragraph("p1")]);
    const r = applyOperation(
      before,
      op("move_block", { blockId: "p1", index: 0, targetSectionId: "s1", columnIndex: 9 }),
    );
    expect(r.ok).toBe(false);
    expect(r.content.blocks.map((b) => b.id)).toEqual(["s1", "p1"]);
  });
});

describe("update_settings", () => {
  it("merges into existing settings", () => {
    const r = applyOperation(
      doc([]),
      op("update_settings", { settings: { backgroundColor: "#000000" } }),
    );
    expect(r.content.settings.backgroundColor).toBe("#000000");
    expect(r.content.settings.width).toBe(600);
  });

  it("rejects a missing settings object", () => {
    const r = applyOperation(doc([]), op("update_settings", {}));
    expect(r.ok).toBe(false);
  });
});

describe("set_content", () => {
  it("replaces the whole document", () => {
    const next = doc([title("new")]);
    const r = applyOperation(doc([title("old")]), op("set_content", { content: next }));
    expect(r.content.blocks.map((b) => b.id)).toEqual(["new"]);
  });

  it("rejects content without a blocks array", () => {
    const r = applyOperation(doc([]), op("set_content", { content: { settings: {} } }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("blocks array");
  });
});

describe("unknown operation", () => {
  it("is rejected by name rather than silently ignored", () => {
    const r = applyOperation(doc([]), op("frobnicate" as TemplateOperation, {}));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Unknown operation "frobnicate"');
  });
});

describe("section-into-column refusal (issue #292)", () => {
  // MJML forbids `mj-section` inside `mj-column`, so a nested section is
  // dropped on export — the content would vanish silently at send time.
  // packages/core/src/editor.ts enforces the same rule at :238 (addBlock) and
  // :311 (moveBlock). That file is FSL and cannot be imported here, so this
  // invariant is reimplemented; if core's rule changes, change both.
  it("refuses to ADD a section into a column", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[]])]),
      op("add_block", { block: section("s2", "1", [[]]), targetSectionId: "s1" }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("cannot be nested inside a section column");
  });

  it("refuses to MOVE a section into a column", () => {
    const r = applyOperation(
      doc([section("s1", "1", [[]]), section("s2", "1", [[]])]),
      op("move_block", { blockId: "s2", index: 0, targetSectionId: "s1" }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("cannot be moved into a section column");
  });

  it("still allows a section at the top level", () => {
    const r = applyOperation(
      doc([]),
      op("add_block", { block: section("s1", "1", [[]]) }),
    );
    expect(r.ok).toBe(true);
    expect(r.content.blocks.map((b) => b.id)).toEqual(["s1"]);
  });
});

describe("operations produce schema-valid documents", () => {
  it("a sequence of operations still validates", () => {
    let content = doc([]);
    const steps = [
      op("add_block", { block: section("s1", "2", [[], []]) }),
      op("add_block", { block: title("t1", "Left"), targetSectionId: "s1", columnIndex: 0 }),
      op("add_block", { block: paragraph("p1", "Right"), targetSectionId: "s1", columnIndex: 1 }),
      op("update_block", { blockId: "t1", updates: { content: "Updated" } }),
      op("update_block_style", { blockId: "p1", styles: { backgroundColor: "#f5f5f5" } }),
      op("update_settings", { settings: { backgroundColor: "#fafafa" } }),
    ];
    for (const step of steps) {
      const result = applyOperation(content, step);
      expect(result.error).toBeUndefined();
      content = result.content;
    }
    expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  });
});
