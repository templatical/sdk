/**
 * Where a palette insert should land, expressed as the trailing arguments of
 * `editor.addBlock(block, targetSectionId?, columnIndex?, index?)`.
 *
 * An empty object means "append at the end" — every field absent, so spreading
 * it into `addBlock` passes `undefined` for all three and takes the push path.
 */
export interface InsertPosition {
  targetSectionId?: string;
  columnIndex?: number;
  index?: number;
}

export interface ResolveInsertPositionOptions {
  /**
   * The type of block about to be inserted. Only `"section"` changes the
   * outcome — custom types (`custom:*`) behave like any other leaf block.
   */
  blockType: string;
  selectedBlockId: string | null;
  findBlockLocation: (blockId: string) => {
    targetSectionId?: string;
    columnIndex?: number;
    index: number;
  } | null;
  isBlockLocked: (blockId: string) => boolean;
}

/**
 * Resolve the insert position for a palette click: directly below the selected
 * block, falling back to appending at the end.
 *
 * Every fallback here exists because `addBlock` refuses the alternative
 * *silently*. Returning a position it rejects would turn the click into a
 * complete no-op — worse for the user than landing at the bottom, which is the
 * behaviour this whole function replaces. So the rule is: only ever return a
 * position `addBlock` will accept.
 *
 * Mirrors `duplicateBlock` in `@templatical/core` (resolve the reference
 * block's location, bump the index by one, append when it can't be resolved) so
 * click-to-insert and duplicate place blocks by the same rule.
 */
export function resolveInsertPosition(
  options: ResolveInsertPositionOptions,
): InsertPosition {
  const { blockType, selectedBlockId, findBlockLocation, isBlockLocked } =
    options;

  if (!selectedBlockId) return {};

  // A selection can outlive its block — a collaborator removes it, an undo
  // drops it — so an unresolvable id means append, never a guessed index.
  const selected = findBlockLocation(selectedBlockId);
  if (!selected) return {};

  if (selected.targetSectionId === undefined) {
    return { index: selected.index + 1 };
  }

  if (blockType === "section") {
    // MJML forbids `mj-section` inside `mj-column`, so `addBlock` rejects the
    // nest outright. Land beside the section the selection sits in instead —
    // the nearest position that accepts a section at all. Sections never nest,
    // so the parent's own location is always top-level.
    const parent = findBlockLocation(selected.targetSectionId);
    if (!parent || parent.targetSectionId !== undefined) return {};
    return { index: parent.index + 1 };
  }

  // `addBlock` bails when the target section is locked, so a locked parent
  // means the column is unavailable — append rather than lose the block.
  if (isBlockLocked(selected.targetSectionId)) return {};

  return {
    targetSectionId: selected.targetSectionId,
    columnIndex: selected.columnIndex,
    index: selected.index + 1,
  };
}
