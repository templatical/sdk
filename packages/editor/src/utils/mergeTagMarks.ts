import type { Editor } from "@tiptap/core";

type State = Editor["state"];
type Marks = ReturnType<State["selection"]["$from"]["marks"]>;

/**
 * Stored marks win. Otherwise a cursor takes the marks before it and a
 * selection the marks of the text it replaces, the rules ProseMirror uses for
 * typed text: `$from.marks()` on a selection would take an inclusive mark from
 * the character before it.
 */
export function marksAtSelection(state: State): Marks {
  const { $from, $to, empty } = state.selection;
  const marks =
    state.storedMarks ??
    (empty ? $from.marks() : ($from.marksAcross($to) ?? []));
  return $from.parent.type.allowedMarks(marks);
}

/** A replacement takes marks from its first text character, including at a paragraph start. */
export function marksOfReplacedText(state: State, from: number): Marks {
  const $from = state.doc.resolve(from);
  return $from.parent.type.allowedMarks($from.nodeAfter?.marks ?? []);
}

/** TipTap content specs carry ProseMirror marks as JSON. */
export function withMergeTagMarks<T extends object>(
  content: T,
  marks: Marks,
): T & { marks?: ReturnType<Marks[number]["toJSON"]>[] } {
  return marks.length
    ? { ...content, marks: marks.map((mark) => mark.toJSON()) }
    : content;
}
