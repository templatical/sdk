/**
 * A paragraph tag, open or close. `[^<>]*` rather than `[^>]*` keeps the
 * match linear: `[^>]*` runs across nested `<` and then backtracks one
 * character at a time when no `>` follows, which is O(n²) over inputs like
 * `<p<p<p…`. Real attributes never contain a raw `<`, so nothing valid is lost.
 */
const PARAGRAPH_TAG = /<\/?p\b[^<>]*>/gi;

/** A paragraph with nothing in it, keeping its attributes in group 1. */
const EMPTY_PARAGRAPH = /<p\b([^<>]*)>\s*<\/p>/gi;

/**
 * Whether rich text holds nothing but paragraph tags and whitespace — what a
 * title or paragraph block stores once its text is cleared.
 */
export function isBlankRichText(html: string): boolean {
  return html.replace(PARAGRAPH_TAG, "").trim() === "";
}

/**
 * Gives every empty paragraph a non-breaking space, so a blank line the author
 * typed is one line tall wherever the text is shown.
 *
 * TipTap stores a blank line as `<p></p>`. ProseMirror draws it a line tall
 * while editing, because it adds a `<br>` for the caret, but anywhere else an
 * empty block has no height and its margins collapse into its neighbours'.
 * Unfilled, the line is missing from the canvas and from the sent email.
 *
 * Applied where rich text is displayed — the renderer and the editor canvas —
 * and never to stored content: a stored `<br>` parses back into a hard break,
 * which ProseMirror draws two lines tall, and a stored `&nbsp;` is a character
 * the caret can land on.
 *
 * Blank text comes back unchanged. The renderer emits nothing for a blank
 * paragraph block, so the canvas must not show a line for one either.
 */
export function fillEmptyParagraphs(html: string): string {
  if (isBlankRichText(html)) {
    return html;
  }
  return html.replace(EMPTY_PARAGRAPH, "<p$1>&nbsp;</p>");
}
