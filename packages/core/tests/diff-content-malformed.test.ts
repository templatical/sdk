import { describe, expect, it } from "vitest";
import type { Block, TemplateContent } from "@templatical/types";
import { applyOperations, OperationError } from "@templatical/types";
import { diffContent } from "../src/diff-content";

/**
 * Content that isn't well formed: a section column that isn't a list. The diff
 * reads such a column as holding no blocks, so it neither throws nor walks
 * into it; what it can't express, the engine refuses.
 */

const leaf = (id: string): Block =>
  ({ id, type: "paragraph", content: `<p>${id}</p>` }) as unknown as Block;
const section = (id: string, children: unknown[]): Block =>
  ({ id, type: "section", columns: "2", children }) as unknown as Block;
const content = (blocks: Block[]): TemplateContent =>
  ({ blocks, settings: { width: 600 } }) as unknown as TemplateContent;

describe("diffContent on a column that isn't a list", () => {
  it("deletes the blocks of a column that stopped being a list", () => {
    const before = content([section("s1", [[leaf("a")], [leaf("b")]])]);
    const after = content([section("s1", [[leaf("a")], null])]);

    expect(diffContent(before, after)).toEqual([
      { op: "deleteBlock", blockId: "b" },
    ]);
  });

  it("adds into a column that wasn't a list before", () => {
    const before = content([section("s1", [[leaf("a")], "pending"])]);
    const after = content([section("s1", [[leaf("a")], [leaf("b")]])]);

    const ops = diffContent(before, after);

    expect(ops).toEqual([
      {
        op: "addBlock",
        block: leaf("b"),
        parent: { sectionId: "s1", column: 1 },
        after: null,
      },
    ]);
    expect(applyOperations(before, ops)).toEqual(after);
  });

  it("passes a new section's malformed column on as it came, for the engine to refuse", () => {
    const before = content([leaf("a")]);
    const added = section("s2", [[leaf("c")], null]);
    const after = content([leaf("a"), added]);

    const ops = diffContent(before, after);

    expect(ops).toEqual([
      { op: "addBlock", block: added, parent: null, after: "a" },
    ]);
    expect(() => applyOperations(before, ops)).toThrow(
      new OperationError(
        "invalid_operation",
        0,
        "A section needs children: a list of columns, each a list of blocks.",
      ),
    );
  });
});
