import { describe, expect, it, vi } from "vitest";
import { resolveInsertPosition } from "../src/utils/resolveInsertPosition";

type Location = {
  targetSectionId?: string;
  columnIndex?: number;
  index: number;
};

/**
 * `findBlockLocation` backed by a plain map, so each case states only the
 * locations it cares about. An id that isn't listed resolves to `null`, which
 * is what the real editor returns for a stale selection.
 */
function locator(locations: Record<string, Location>) {
  return vi.fn((blockId: string) => locations[blockId] ?? null);
}

const nothingLocked = () => false;

describe("resolveInsertPosition", () => {
  it("appends when nothing is selected", () => {
    expect(
      resolveInsertPosition({
        blockType: "divider",
        selectedBlockId: null,
        findBlockLocation: locator({}),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({});
  });

  it("appends when the selected block no longer resolves", () => {
    // A selection can outlive its block — a collaborator removes it, or an
    // undo drops it — and `findBlockLocation` returns null. Appending is the
    // only safe answer; deriving an index from a stale id would misplace it.
    const findBlockLocation = locator({ "block-a": { index: 3 } });

    expect(
      resolveInsertPosition({
        blockType: "divider",
        selectedBlockId: "ghost",
        findBlockLocation,
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({});
    expect(findBlockLocation).toHaveBeenCalledWith("ghost");
  });

  it("inserts directly after a top-level selection", () => {
    expect(
      resolveInsertPosition({
        blockType: "divider",
        selectedBlockId: "block-a",
        findBlockLocation: locator({ "block-a": { index: 4 } }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({ index: 5 });
  });

  it("inserts after a top-level selection at index 0", () => {
    // Guards the falsy-zero class: index 0 is a real position, not "unset".
    expect(
      resolveInsertPosition({
        blockType: "paragraph",
        selectedBlockId: "first",
        findBlockLocation: locator({ first: { index: 0 } }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({ index: 1 });
  });

  it("inserts into the same section column after a nested selection", () => {
    expect(
      resolveInsertPosition({
        blockType: "divider",
        selectedBlockId: "child",
        findBlockLocation: locator({
          child: { targetSectionId: "sec-1", columnIndex: 1, index: 2 },
        }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({ targetSectionId: "sec-1", columnIndex: 1, index: 3 });
  });

  it("preserves columnIndex 0 for a nested selection", () => {
    // `columnIndex: 0` is falsy, so a truthiness check would silently drop the
    // column and `addBlock` would default to column 0 by luck rather than by
    // intent — and would be wrong the moment the default changes.
    const position = resolveInsertPosition({
      blockType: "paragraph",
      selectedBlockId: "child",
      findBlockLocation: locator({
        child: { targetSectionId: "sec-1", columnIndex: 0, index: 0 },
      }),
      isBlockLocked: nothingLocked,
    });

    expect(position).toEqual({
      targetSectionId: "sec-1",
      columnIndex: 0,
      index: 1,
    });
    expect(Object.hasOwn(position, "columnIndex")).toBe(true);
  });

  it("places a section after the parent section when the selection is nested", () => {
    // `addBlock` refuses a section inside a column (MJML forbids `mj-section`
    // in `mj-column`), so targeting the column would make the click a silent
    // no-op. Top level, after the section the selection lives in, is the
    // nearest position that actually accepts the block.
    expect(
      resolveInsertPosition({
        blockType: "section",
        selectedBlockId: "child",
        findBlockLocation: locator({
          child: { targetSectionId: "sec-1", columnIndex: 0, index: 2 },
          "sec-1": { index: 6 },
        }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({ index: 7 });
  });

  it("appends a section when the parent section's own location is unknown", () => {
    expect(
      resolveInsertPosition({
        blockType: "section",
        selectedBlockId: "child",
        findBlockLocation: locator({
          child: { targetSectionId: "sec-1", columnIndex: 0, index: 2 },
          // "sec-1" deliberately absent
        }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({});
  });

  it("appends when the parent section is locked by a collaborator", () => {
    // `addBlock` bails on a locked target section, so resolving the column
    // would drop the block entirely. Appending keeps the insert working.
    const isBlockLocked = vi.fn((id: string) => id === "sec-1");

    expect(
      resolveInsertPosition({
        blockType: "divider",
        selectedBlockId: "child",
        findBlockLocation: locator({
          child: { targetSectionId: "sec-1", columnIndex: 0, index: 2 },
        }),
        isBlockLocked,
      }),
    ).toEqual({});
    expect(isBlockLocked).toHaveBeenCalledWith("sec-1");
  });

  it("does not consult the lock when the selection is top-level", () => {
    // Top-level inserts have no lock check in `addBlock`, so asking would
    // imply a constraint that doesn't exist.
    const isBlockLocked = vi.fn(() => true);

    expect(
      resolveInsertPosition({
        blockType: "divider",
        selectedBlockId: "block-a",
        findBlockLocation: locator({ "block-a": { index: 1 } }),
        isBlockLocked,
      }),
    ).toEqual({ index: 2 });
    expect(isBlockLocked).not.toHaveBeenCalled();
  });

  it("puts an ordinary block after a selected section, never inside it", () => {
    // A selected section is a top-level selection like any other. Inserting
    // into its first column would be a different gesture than the user made.
    expect(
      resolveInsertPosition({
        blockType: "paragraph",
        selectedBlockId: "sec-1",
        findBlockLocation: locator({ "sec-1": { index: 3 } }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({ index: 4 });
  });

  it("places a section after a selected top-level section", () => {
    expect(
      resolveInsertPosition({
        blockType: "section",
        selectedBlockId: "sec-1",
        findBlockLocation: locator({ "sec-1": { index: 3 } }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({ index: 4 });
  });

  it("treats a custom block type like any other non-section block", () => {
    expect(
      resolveInsertPosition({
        blockType: "custom:testimonial",
        selectedBlockId: "child",
        findBlockLocation: locator({
          child: { targetSectionId: "sec-1", columnIndex: 1, index: 0 },
        }),
        isBlockLocked: nothingLocked,
      }),
    ).toEqual({ targetSectionId: "sec-1", columnIndex: 1, index: 1 });
  });
});
