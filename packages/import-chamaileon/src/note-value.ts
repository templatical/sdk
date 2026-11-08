/**
 * Keep a quoted source value concise in import report text: at most 80
 * UTF-16 units, never ending on half of a surrogate pair.
 */
export function noteValue(value: string): string {
  if (value.length <= 80) return value;
  const end = /[\uD800-\uDBFF]/.test(value[79]) ? 79 : 80;
  return `${value.slice(0, end)}…`;
}
