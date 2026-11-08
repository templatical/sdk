/**
 * Keep a quoted source value concise in import report text: at most 80
 * UTF-16 units, never ending on half of a surrogate pair. Takes any value,
 * since a document can put a number where a string belongs.
 */
export function noteValue(value: unknown): string {
  const text = String(value);
  if (text.length <= 80) return text;
  const end = /[\uD800-\uDBFF]/.test(text[79]) ? 79 : 80;
  return `${text.slice(0, end)}…`;
}
