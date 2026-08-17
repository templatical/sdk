import type { Block, TemplateSettings } from "@templatical/types";
import type { UseHistoryReturn } from "./history";

/**
 * The mutable slice of an editor this wraps — structural, so the OSS and Cloud
 * `useEditor` returns both satisfy it without either having to grow toward the
 * other. Not `Readonly`: the whole point is to replace these members in place.
 */
export interface HistoryInterceptorEditor {
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
    index?: number,
  ) => void;
  removeBlock: (blockId: string) => void;
  moveBlock: (
    blockId: string,
    newIndex: number,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  updateSettings: (updates: Partial<TemplateSettings>) => void;
  isBlockLocked: (blockId: string) => boolean;
}

/**
 * Wraps editor mutation methods to record history snapshots before each
 * operation. Mutates the editor object in place.
 *
 * Must be applied **after** any collaboration broadcast wrapping so the
 * call chain is: history.record() → broadcast → original mutation.
 */
export function useHistoryInterceptor(
  editor: HistoryInterceptorEditor,
  history: UseHistoryReturn,
): void {
  const originalAddBlock = editor.addBlock;
  const originalRemoveBlock = editor.removeBlock;
  const originalMoveBlock = editor.moveBlock;
  const originalUpdateBlock = editor.updateBlock;
  const originalUpdateSettings = editor.updateSettings;

  // Skip recording when the underlying op is a no-op (e.g., a peer-locked
  // block or section), otherwise the undo stack fills with snapshots that
  // are identical to current state and undo silently does nothing.
  editor.addBlock = (block, targetSectionId?, columnIndex?, index?) => {
    if (targetSectionId && editor.isBlockLocked(targetSectionId)) {
      return;
    }
    history.record();
    originalAddBlock(block, targetSectionId, columnIndex, index);
  };

  editor.removeBlock = (blockId) => {
    if (editor.isBlockLocked(blockId)) {
      return;
    }
    history.record();
    originalRemoveBlock(blockId);
  };

  editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
    if (editor.isBlockLocked(blockId)) {
      return;
    }
    if (targetSectionId && editor.isBlockLocked(targetSectionId)) {
      return;
    }
    history.record();
    originalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
  };

  editor.updateBlock = (blockId, updates) => {
    if (editor.isBlockLocked(blockId)) {
      return;
    }
    history.recordDebounced(blockId);
    originalUpdateBlock(blockId, updates);
  };

  editor.updateSettings = (updates) => {
    history.record();
    originalUpdateSettings(updates);
  };
}
