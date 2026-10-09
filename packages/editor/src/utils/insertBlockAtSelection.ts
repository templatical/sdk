import type { Block } from "@templatical/types";
import {
  resolveInsertPosition,
  type ResolveInsertPositionOptions,
} from "./resolveInsertPosition";

/** The slice of the core editor a click-to-insert needs. */
export interface InsertBlockTarget {
  state: { selectedBlockId: string | null };
  findBlockLocation: ResolveInsertPositionOptions["findBlockLocation"];
  isBlockLocked: ResolveInsertPositionOptions["isBlockLocked"];
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
    index?: number,
  ) => void;
  selectBlock: (blockId: string | null) => void;
}

/**
 * Insert a block the way a palette click does: below the selection, by the
 * rules in `resolveInsertPosition`, then select it. Shared by the sidebar and
 * the public `insertBlock()`, so the two can never place a block differently.
 *
 * Returns whether the block landed. `addBlock` refuses silently, and selecting
 * an id it never added would leave a selection the next insert resolves
 * against.
 */
export function insertBlockAtSelection(
  editor: InsertBlockTarget,
  block: Block,
): boolean {
  const { targetSectionId, columnIndex, index } = resolveInsertPosition({
    blockType: block.type,
    selectedBlockId: editor.state.selectedBlockId,
    findBlockLocation: editor.findBlockLocation,
    isBlockLocked: editor.isBlockLocked,
  });
  editor.addBlock(block, targetSectionId, columnIndex, index);
  if (!editor.findBlockLocation(block.id)) return false;
  editor.selectBlock(block.id);
  return true;
}
