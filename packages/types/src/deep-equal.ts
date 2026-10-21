function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Structural equality for JSON values, the comparison the operation engine
 * uses for `expect`: object key order is ignored, arrays compare in order, an
 * array never equals an object, and numbers compare by value (`1` and `1.0`
 * are the same JSON number). `null` is a value, so `{ a: null }` differs from
 * `{}`; an object key holding `undefined` counts as absent, because JSON
 * drops it.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a)) {
    if (!isPlainObject(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] === undefined && b[key] === undefined) continue;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}
