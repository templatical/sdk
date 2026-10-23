/**
 * Result of a merge-tag trigger scan — the caret sits inside an open tag.
 */
export interface OpenMergeTagTrigger {
  /** Index in the field value where the trigger opener starts. */
  triggerStart: number;
  /** Caret index the scan ran at (also the end of `query`). */
  caret: number;
  /** Text typed between the opener and the caret — the autocomplete filter. */
  query: string;
}

/**
 * Detects whether the caret sits inside an *open* merge-tag trigger: the user
 * has typed the syntax opener (e.g. `{{`) and is mid-typing the tag name with
 * no closing delimiter yet. Returns the opener position + query so the caller
 * can drive the autocomplete popup, or `null` when the caret is not inside an
 * open trigger.
 *
 * Mirrors `@tiptap/suggestion`'s behavior with `allowSpaces: false`: the run
 * between the opener and the caret ends at the first whitespace, and a closing
 * delimiter inside that run means the tag is already complete (`{{first_name}}`)
 * so the popup must not reappear over it.
 *
 * `complete` is the syntax's `value` regex. An opener inside a tag it matches
 * never counts, which is what keeps a syntax whose opener and closer are the
 * same (`%FIRSTNAME%`) from reading its own closer as a new opener. The closer
 * check stays for text the regex rejects, such as liquid's `{{}}`.
 */
export function findOpenMergeTagTrigger(
  value: string,
  caret: number,
  triggerChar: string,
  closingChar: string | null,
  complete?: RegExp,
): OpenMergeTagTrigger | null {
  if (!triggerChar) return null;

  const before = value.slice(0, caret);
  const triggerStart = before.lastIndexOf(triggerChar);
  if (triggerStart === -1) return null;
  if (complete && triggerStart < lastCompleteTagEnd(before, complete)) {
    return null;
  }

  const query = before.slice(triggerStart + triggerChar.length);

  // Whitespace ends the query (allowSpaces: false parity).
  if (/\s/.test(query)) return null;

  // A closing delimiter between the opener and the caret means the tag is
  // already complete — don't reopen the popup over a finished tag.
  if (closingChar && query.includes(closingChar)) return null;

  return { triggerStart, caret, query };
}

/**
 * Where the last tag `complete` matches in `text` ends, or 0 when none does.
 * It scans a fresh global copy that keeps the other flags (`i` included):
 * `matchAll` on the caller's regex would start from its `lastIndex`, throws on
 * a non-global one, and sticky (`y`) would stop at the first gap.
 */
function lastCompleteTagEnd(text: string, complete: RegExp): number {
  const scan = new RegExp(
    complete.source,
    `${complete.flags.replace(/[gy]/g, "")}g`,
  );
  let end = 0;
  for (const match of text.matchAll(scan)) {
    end = match.index + match[0].length;
  }
  return end;
}
