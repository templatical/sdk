import type { UseHistoryReturn } from "@templatical/core";

export interface KeyboardShortcutHandlers {
  history: UseHistoryReturn;
  selectBlock: (blockId: string | null) => void;
  getSelectedBlockId: () => string | null;
  removeBlock: (blockId: string) => void;
  onSave?: () => void;
  onBeforeUndo?: () => void;
}

/**
 * Returns true when the keyboard event target is a text-editing context
 * (input, textarea, select, or contentEditable element like TipTap).
 * Used to let native/TipTap controls handle their own key events.
 */
export function isEditingText(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Shared keyboard shortcut handler for both OSS and Cloud editors.
 *
 * - Cmd/Ctrl+Z: undo (skipped when editing text — TipTap handles its own undo)
 * - Cmd/Ctrl+Shift+Z: redo (skipped when editing text)
 * - Cmd/Ctrl+S: save
 * - Escape: deselect block
 * - Delete/Backspace: remove selected block (skipped when editing text)
 */
export function handleEditorKeydown(
  e: KeyboardEvent,
  handlers: KeyboardShortcutHandlers,
): void {
  const isCmd = e.metaKey || e.ctrlKey;

  // Cmd/Ctrl+S: save
  if (isCmd && e.key.toLowerCase() === "s") {
    e.preventDefault();
    handlers.onSave?.();
    return;
  }

  // Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z: undo/redo
  if (isCmd && e.key.toLowerCase() === "z") {
    // Let TipTap handle its own undo/redo when editing text
    if (isEditingText(e)) {
      return;
    }

    e.preventDefault();

    if (e.shiftKey) {
      handlers.history.redo();
    } else {
      handlers.onBeforeUndo?.();
      handlers.history.undo();
    }
    return;
  }

  // Escape: deselect
  if (e.key === "Escape") {
    handlers.selectBlock(null);
    return;
  }

  // Delete/Backspace: remove selected block
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    handlers.getSelectedBlockId() &&
    !isEditingText(e)
  ) {
    e.preventDefault();
    handlers.history.record();
    handlers.removeBlock(handlers.getSelectedBlockId()!);
  }
}
