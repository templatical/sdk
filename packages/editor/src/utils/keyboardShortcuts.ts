import type { UseHistoryReturn } from "@templatical/core";

export interface KeyboardShortcutHandlers {
  history: UseHistoryReturn;
  selectBlock: (blockId: string | null) => void;
  getSelectedBlockId: () => string | null;
  removeBlock: (blockId: string) => void;
  onSave?: () => void;
  onBeforeUndo?: () => void;
  /** True while a saved-blocks pick session is running. */
  isPicking?: () => boolean;
  onConfirmPick?: () => void;
  onCancelPick?: () => void;
}

/**
 * Returns true when the keyboard event originated from a text-editing
 * context (input, textarea, select, or contentEditable element like
 * TipTap). Used to let native/TipTap controls handle their own key
 * events so the editor doesn't, for example, delete the whole block on
 * Backspace mid-typing.
 *
 * Walks `event.composedPath()` rather than reading `event.target`
 * directly. When the editor mounts inside a shadow root and a global
 * keydown listener at `document` level receives the event, the browser
 * retargets `event.target` to the shadow host element — so the actual
 * focused contenteditable inside the shadow tree is invisible via
 * `event.target` alone. The composed path traverses through every
 * shadow boundary the event crossed and exposes the real innermost
 * element, which is what we need to inspect.
 *
 * Light-DOM mode: `composedPath()` returns the same chain as `target`'s
 * ancestors, so behavior is unchanged.
 */
export function isEditingText(e: KeyboardEvent): boolean {
  for (const node of e.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.isContentEditable) return true;
    const tag = node.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  }
  return false;
}

/**
 * Shared keyboard shortcut handler for both OSS and Cloud editors.
 *
 * - Cmd/Ctrl+Z: undo (skipped when editing text — TipTap handles its own undo)
 * - Cmd/Ctrl+Shift+Z: redo (skipped when editing text)
 * - Cmd/Ctrl+S: save
 * - Escape: deselect block
 * - Delete/Backspace: remove selected block (skipped when editing text)
 *
 * While a saved-blocks pick session runs, Escape/Enter drive the session and
 * Delete/Backspace are swallowed — see the block below.
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

  // Pick session owns Escape/Enter, and blocks destructive keys. Placed after
  // save/undo (those stay useful) but before selection handling: Escape must
  // cancel the session rather than deselect, and Delete must not remove a block
  // the user is only trying to pick. Text-editing contexts are excluded so
  // typing a name in a nested input is unaffected.
  if (handlers.isPicking?.() && !isEditingText(e)) {
    if (e.key === "Escape") {
      e.preventDefault();
      handlers.onCancelPick?.();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handlers.onConfirmPick?.();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      return;
    }
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
