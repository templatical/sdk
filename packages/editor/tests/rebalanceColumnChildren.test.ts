import { describe, expect, it } from "vitest";
import { createParagraphBlock } from "@templatical/types";
import { rebalanceColumnChildren } from "../src/utils/rebalanceColumnChildren";

describe("rebalanceColumnChildren", () => {
  it("returns current array when count already matches '1'", () => {
    const a = createParagraphBlock();
    const current = [[a]];
    const result = rebalanceColumnChildren(current, "1");
    expect(result).toBe(current);
  });

  it("returns current array when count already matches '2'", () => {
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const current = [[a], [b]];
    const result = rebalanceColumnChildren(current, "2");
    expect(result).toBe(current);
  });

  it("treats '1-2' and '2-1' as 2 columns", () => {
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const current = [[a], [b]];
    expect(rebalanceColumnChildren(current, "1-2")).toBe(current);
    expect(rebalanceColumnChildren(current, "2-1")).toBe(current);
  });

  it("grows 1 → 2 by appending an empty column", () => {
    const a = createParagraphBlock();
    const result = rebalanceColumnChildren([[a]], "2");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([a]);
    expect(result[1]).toEqual([]);
  });

  it("grows 1 → 3 by appending two empty columns", () => {
    const a = createParagraphBlock();
    const result = rebalanceColumnChildren([[a]], "3");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([a]);
    expect(result[1]).toEqual([]);
    expect(result[2]).toEqual([]);
  });

  it("grows 2 → 3 by appending one empty column", () => {
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const result = rebalanceColumnChildren([[a], [b]], "3");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([a]);
    expect(result[1]).toEqual([b]);
    expect(result[2]).toEqual([]);
  });

  it("shrinks 2 → 1 by merging trailing column into the first", () => {
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const result = rebalanceColumnChildren([[a], [b]], "1");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([a, b]);
  });

  it("shrinks 3 → 1 by merging all trailing columns into the first", () => {
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const c = createParagraphBlock();
    const result = rebalanceColumnChildren([[a], [b], [c]], "1");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([a, b, c]);
  });

  it("shrinks 3 → 2 by merging the trailing column into the second", () => {
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const c = createParagraphBlock();
    const result = rebalanceColumnChildren([[a], [b], [c]], "2");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([a]);
    expect(result[1]).toEqual([b, c]);
  });

  it("preserves all blocks across shrink+grow round-trip", () => {
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    const start = [[a], [b]];
    const shrunk = rebalanceColumnChildren(start, "1");
    const regrown = rebalanceColumnChildren(shrunk, "2");
    expect(regrown[0]).toEqual([a, b]);
    expect(regrown[1]).toEqual([]);
  });
});
