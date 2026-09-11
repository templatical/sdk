import type { TemplateOperationPayload } from "@templatical/types";
import type { UseEditorReturn } from "../editor";

interface BroadcastTarget {
  _broadcastOperation: (payload: TemplateOperationPayload) => void;
}

/**
 * Wraps editor mutation methods to broadcast operations to collaboration
 * peers after each mutation executes. Mutates the editor object in place.
 *
 * Must be applied **before** the history interceptor so the call chain is:
 * history.record() → broadcast + original mutation.
 */
export function useCollaborationBroadcast(
  // The six members it actually replaces, rather than a whole editor. It is
  // handed the *cloud* editor while this annotation names the OSS one, so any
  // member either gains that the other lacks would break this call site for
  // reasons that have nothing to do with broadcasting.
  editor: Pick<
    UseEditorReturn,
    | "addBlock"
    | "updateBlock"
    | "removeBlock"
    | "moveBlock"
    | "updateSettings"
    | "setContent"
  >,
  collaboration: BroadcastTarget,
): void {
  const originalAddBlock = editor.addBlock;
  const originalUpdateBlock = editor.updateBlock;
  const originalRemoveBlock = editor.removeBlock;
  const originalMoveBlock = editor.moveBlock;
  const originalUpdateSettings = editor.updateSettings;
  const originalSetContent = editor.setContent;

  editor.addBlock = (block, targetSectionId?, columnIndex?, index?) => {
    originalAddBlock(block, targetSectionId, columnIndex, index);
    collaboration._broadcastOperation({
      operation: "addBlock",
      data: {
        block,
        sectionId: targetSectionId,
        columnIndex: columnIndex,
        index,
      },
      timestamp: Date.now(),
    });
  };

  editor.updateBlock = (blockId, updates) => {
    originalUpdateBlock(blockId, updates);
    collaboration._broadcastOperation({
      operation: "updateBlock",
      data: { blockId: blockId, updates },
      timestamp: Date.now(),
    });
  };

  editor.removeBlock = (blockId) => {
    originalRemoveBlock(blockId);
    collaboration._broadcastOperation({
      operation: "deleteBlock",
      data: { blockId: blockId },
      timestamp: Date.now(),
    });
  };

  editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
    originalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
    collaboration._broadcastOperation({
      operation: "moveBlock",
      data: {
        blockId: blockId,
        index: newIndex,
        sectionId: targetSectionId,
        columnIndex: columnIndex,
      },
      timestamp: Date.now(),
    });
  };

  editor.updateSettings = (updates) => {
    originalUpdateSettings(updates);
    collaboration._broadcastOperation({
      operation: "updateSettings",
      data: { updates },
      timestamp: Date.now(),
    });
  };

  editor.setContent = (content, markDirty?) => {
    originalSetContent(content, markDirty);
    collaboration._broadcastOperation({
      operation: "setContent",
      data: { content },
      timestamp: Date.now(),
    });
  };
}
