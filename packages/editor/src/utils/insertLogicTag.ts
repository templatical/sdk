import type { LogicPair, SyntaxPreset } from "@templatical/types";
import type { Editor } from "@tiptap/core";
import type { LogicTagPickerResult } from "../composables/useLogicTagPicker";
import { mergeTagNodeSpec } from "./mergeTagNodeSpec";
import {
  marksAtPosition,
  marksAtSelection,
  withMergeTagMarks,
} from "./mergeTagMarks";

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
      .insertContent(
        withMergeTagMarks(
          mergeTagNodeSpec(item.value, item.label, syntax),
          marksAtSelection(editor.state),
        ),
      )
      .run();
    return;
  }

  const { from, to } = editor.state.selection;

  if (from !== to) {
    const openSpec = withMergeTagMarks(
      mergeTagNodeSpec(item.before, item.label, syntax),
      marksAtPosition(editor.state, from),
    );
    const closeSpec = withMergeTagMarks(
      mergeTagNodeSpec(item.after, item.label, syntax),
      marksAtPosition(editor.state, to),
    );
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

  const marks = marksAtSelection(editor.state);
  const openSpec = withMergeTagMarks(
    mergeTagNodeSpec(item.before, item.label, syntax),
    marks,
  );
  const closeSpec = withMergeTagMarks(
    mergeTagNodeSpec(item.after, item.label, syntax),
    marks,
  );
  // No selection: drop both pills and park the caret between them. Each pill
  // is an inline atom of size 1, so the gap sits at `from + 1`.
  editor
    .chain()
    .focus()
    .insertContentAt(from, [openSpec, closeSpec])
    .setTextSelection(from + 1)
    .run();
}
