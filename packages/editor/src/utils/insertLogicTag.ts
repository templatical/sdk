import type { LogicPair, SyntaxPreset } from "@templatical/types";
import type { Editor } from "@tiptap/core";
import type { LogicTagPickerResult } from "../composables/useLogicTagPicker";
import { mergeTagNodeSpec } from "./mergeTagNodeSpec";

/** A pair carries `before`/`after`; a standalone tag carries `value`. */
export function isLogicTagPair(item: LogicTagPickerResult): item is LogicPair {
  return "before" in item && "after" in item;
}

/**
 * Insert a chosen logic tag or pair into the editor. Each side becomes a
 * `logicMergeTagNode` (via `mergeTagNodeSpec`), matching typed/pasted logic.
 *
 * - Standalone tag → inserted at the cursor.
 * - Pair with a non-empty selection → wraps it: `[before]{selection}[after]`.
 * - Pair with no selection → both pills adjacent, caret placed between them.
 */
export function insertLogicTagSelection(
  editor: Editor,
  item: LogicTagPickerResult,
  syntax: SyntaxPreset,
): void {
  if (!isLogicTagPair(item)) {
    editor
      .chain()
      .focus()
      .insertContent(mergeTagNodeSpec(item.value, item.label, syntax))
      .run();
    return;
  }

  const openSpec = mergeTagNodeSpec(item.before, item.label, syntax);
  const closeSpec = mergeTagNodeSpec(item.after, item.label, syntax);
  const { from, to } = editor.state.selection;

  if (from !== to) {
    // Wrap the selection. Insert the closer at `to` first so the opener's
    // insert at `from` (which shifts everything after it) doesn't invalidate
    // `to` mid-chain — `from < to`, so `to`'s insert leaves `from` valid.
    editor
      .chain()
      .focus()
      .insertContentAt(to, closeSpec)
      .insertContentAt(from, openSpec)
      .run();
    return;
  }

  // No selection: drop both pills and park the caret between them. Each pill
  // is an inline atom of size 1, so the gap sits at `from + 1`.
  editor
    .chain()
    .focus()
    .insertContentAt(from, [openSpec, closeSpec])
    .setTextSelection(from + 1)
    .run();
}
