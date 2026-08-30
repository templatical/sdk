/** Escape a string for embedding as literal text in a `RegExp`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `fn`'s own source is method-shorthand syntax for exactly `key` —
 * `key(...) { }`, optionally `async` and/or generator (`*`) prefixed.
 *
 * Anchored on the full name, not a prefix: `listDelay: async list(){}` must
 * keep its `key: ` prefix (the source names a *different* method, `list`),
 * and so must `list: async listDelay(){}` (the key names a method the source
 * doesn't define). An arrow never matches — its source has no bare-identifier
 * call-like head — so it always keeps its `key: ` prefix too, even when the
 * key happens to equal a parameter name the arrow declares.
 */
function isMethodShorthand(
  key: string,
  fn: unknown,
): fn is (...args: unknown[]) => unknown {
  if (typeof fn !== "function") return false;
  const pattern = new RegExp(
    `^(?:async\\s+)?(?:\\*\\s*)?${escapeRegExp(key)}\\s*\\(`,
  );
  return pattern.test(fn.toString());
}

/**
 * Print a config object as TypeScript source.
 *
 * Function values print their own source via `Function.prototype.toString()`,
 * which is what makes the panel incapable of drifting: there is no second,
 * hand-written copy of the config anywhere. See the round-trip test.
 *
 * A method-shorthand function's source already opens with its own name — a
 * `key: ` prefix in front of it doubles the name into invalid syntax, so a
 * key whose value takes that shape is printed as the source alone.
 */
export function renderConfig(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);

  if (typeof value === "function") return value.toString();
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null || typeof value !== "object") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => padInner + renderConfig(v, indent + 1));
    return "[\n" + items.join(",\n") + "\n" + pad + "]";
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const lines = entries.map(([k, v]) =>
    isMethodShorthand(k, v)
      ? padInner + v.toString()
      : padInner + k + ": " + renderConfig(v, indent + 1),
  );
  return "{\n" + lines.join(",\n") + "\n" + pad + "}";
}
