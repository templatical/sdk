import type { McpOperationPayload } from "@templatical/types";
import type { UseEditorReturn } from "../editor";

interface BroadcastTarget {
  _broadcastOperation: (payload: McpOperationPayload) => void;
}

/**
 * Wraps editor mutation methods to broadcast operations to collaboration
 * peers after each mutation executes. Mutates the editor object in place.
 *
 * Must be applied **before** the history interceptor so the call chain is:
 * history.record() → broadcast + original mutation.
 */
export function useCollaborationBroadcast(
  editor: UseEditorReturn,
  collaboration: BroadcastTarget,
): void {
  const originalAddBlock = editor.addBlock;
  const originalUpdateBlock = editor.updateBlock;
  const originalRemoveBlock = editor.removeBlock;
  const originalMoveBlock = editor.moveBlock;
  const originalUpdateSettings = editor.updateSettings;
  const originalSetContent = editor.setContent;

  editor.addBlock = (block, targetSectionId?, columnIndex?) => {
    originalAddBlock(block, targetSectionId, columnIndex);
    collaboration._broadcastOperation({
      operation: "add_block",
      data: {
        block,
        section_id: targetSectionId,
        column_index: columnIndex,
      },
      timestamp: Date.now(),
    });
  };

  editor.updateBlock = (blockId, updates) => {
    originalUpdateBlock(blockId, updates);
    collaboration._broadcastOperation({
      operation: "update_block",
      data: { block_id: blockId, updates },
      timestamp: Date.now(),
    });
  };

  editor.removeBlock = (blockId) => {
    originalRemoveBlock(blockId);
    collaboration._broadcastOperation({
      operation: "delete_block",
      data: { block_id: blockId },
      timestamp: Date.now(),
    });
  };

  editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
    originalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
    collaboration._broadcastOperation({
      operation: "move_block",
      data: {
        block_id: blockId,
        index: newIndex,
        section_id: targetSectionId,
        column_index: columnIndex,
      },
      timestamp: Date.now(),
    });
  };

  editor.updateSettings = (updates) => {
    originalUpdateSettings(updates);
    collaboration._broadcastOperation({
      operation: "update_settings",
      data: { updates },
      timestamp: Date.now(),
    });
  };

  editor.setContent = (content, markDirty?) => {
    originalSetContent(content, markDirty);
    collaboration._broadcastOperation({
      operation: "set_content",
      data: { content },
      timestamp: Date.now(),
    });
  };
}
