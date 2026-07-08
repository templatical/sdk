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
 */
export function findOpenMergeTagTrigger(
  value: string,
  caret: number,
  triggerChar: string,
  closingChar: string | null,
): OpenMergeTagTrigger | null {
  if (!triggerChar) return null;

  const before = value.slice(0, caret);
  const triggerStart = before.lastIndexOf(triggerChar);
  if (triggerStart === -1) return null;

  const query = before.slice(triggerStart + triggerChar.length);

  // Whitespace ends the query (allowSpaces: false parity).
  if (/\s/.test(query)) return null;

  // A closing delimiter between the opener and the caret means the tag is
  // already complete — don't reopen the popup over a finished tag.
  if (closingChar && query.includes(closingChar)) return null;

  return { triggerStart, caret, query };
}
