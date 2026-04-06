import type { UseEditorReturn } from "./editor";
import type { UseHistoryReturn } from "./history";

/**
 * Wraps editor mutation methods to record history snapshots before each
 * operation. Mutates the editor object in place.
 *
 * Must be applied **after** any collaboration broadcast wrapping so the
 * call chain is: history.record() → broadcast → original mutation.
 */
export function useHistoryInterceptor(
  editor: UseEditorReturn,
  history: UseHistoryReturn,
): void {
  const originalAddBlock = editor.addBlock;
  const originalRemoveBlock = editor.removeBlock;
  const originalMoveBlock = editor.moveBlock;
  const originalUpdateBlock = editor.updateBlock;
  const originalUpdateSettings = editor.updateSettings;

  editor.addBlock = (block, targetSectionId?, columnIndex?, index?) => {
    history.record();
    originalAddBlock(block, targetSectionId, columnIndex, index);
  };

  editor.removeBlock = (blockId) => {
    history.record();
    originalRemoveBlock(blockId);
  };

  editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
    history.record();
    originalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
  };

  editor.updateBlock = (blockId, updates) => {
    history.recordDebounced(blockId);
    originalUpdateBlock(blockId, updates);
  };

  editor.updateSettings = (updates) => {
    history.record();
    originalUpdateSettings(updates);
  };
}
