/**
 * Print a config object as TypeScript source.
 *
 * Function values print their own source via `Function.prototype.toString()`,
 * which is what makes the panel incapable of drifting: there is no second,
 * hand-written copy of the config anywhere. See the round-trip test.
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
  const lines = entries.map(
    ([k, v]) => padInner + k + ": " + renderConfig(v, indent + 1),
  );
  return "{\n" + lines.join(",\n") + "\n" + pad + "}";
}
