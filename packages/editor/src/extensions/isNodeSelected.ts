import type { Editor } from "@tiptap/core";

/**
 * Decides whether MergeTagNode / LogicMergeTagNode should swallow a
 * Backspace/Delete keystroke (returning `true` from a TipTap keymap
 * suppresses the default behavior).
 *
 * Only suppresses in the cursor-adjacent case so the "first press
 * selects the atom, second press deletes it" UX works. Range selections
 * (Cmd+A, drag-select, double-click-word) explicitly fall through —
 * default `replaceSelection` then deletes the entire range including
 * any merge-tag atoms inside it.
 *
 * Earlier revisions also returned `true` whenever `nodesBetween($from,
 * $to)` found a merge tag anywhere in the selection range — which
 * silently broke Cmd+A + Backspace for any paragraph containing a
 * merge tag (entire deletion was cancelled, nothing happened). The
 * cursor-adjacent protection is the only piece that should survive.
 */
export function isNodeSelected(editor: Editor, nodeTypeName: string): boolean {
  const { $from, $to } = editor.state.selection;

  // Range selection: let TipTap's default range-delete run. Even when
  // the range contains atom nodes, ProseMirror's replaceSelection
  // handles atomic deletion correctly.
  if ($from.pos !== $to.pos) return false;

  // Cursor-adjacent atom: protect from single-keystroke deletion.
  // (`$from.pos > 0` guards against reading `nodeBefore` at doc start
  // where ProseMirror's index would be undefined for nodeBefore.)
  if ($from.pos > 0 && $from.nodeBefore?.type.name === nodeTypeName) {
    return true;
  }
  if ($from.nodeAfter?.type.name === nodeTypeName) {
    return true;
  }

  return false;
}
