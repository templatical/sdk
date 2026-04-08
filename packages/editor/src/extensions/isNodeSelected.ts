import type { Editor } from "@tiptap/core";

/**
 * Checks whether a TipTap node of the given type is selected, or if the cursor
 * is immediately adjacent to one (for Backspace/Delete handling).
 *
 * Shared by MergeTagNode and LogicMergeTagNode keyboard shortcuts.
 */
export function isNodeSelected(editor: Editor, nodeTypeName: string): boolean {
  const { selection } = editor.state;
  const { $from, $to } = selection;

  // Check if selection contains a node of this type
  let found = false;
  editor.state.doc.nodesBetween($from.pos, $to.pos, (node) => {
    if (node.type.name === nodeTypeName) {
      found = true;
      return false;
    }
  });

  if (found) {
    return true;
  }

  // Check if cursor is right after the node (for Backspace)
  if ($from.pos > 0 && $from.nodeBefore?.type.name === nodeTypeName) {
    return true;
  }

  // Check if cursor is right before the node (for Delete)
  if ($from.nodeAfter?.type.name === nodeTypeName) {
    return true;
  }

  return false;
}
