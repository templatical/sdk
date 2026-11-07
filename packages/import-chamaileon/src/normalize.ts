import type { ChamaileonNode, ChamaileonVariable } from "./types";

export function isUnset(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed === "" ||
    trimmed === "url()" ||
    trimmed.toLowerCase() === "transparent"
  );
}

export function camelKey(key: string): string {
  return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function isVariableObject(
  value: unknown,
): value is { reference?: unknown; default?: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("reference" in value || "default" in value)
  );
}

// One lookup table per document's variables. The first variable with a name
// wins, as a linear search would pick it.
const variablesByName = new WeakMap<
  ChamaileonVariable[],
  Map<string, ChamaileonVariable>
>();

function findVariable(
  variables: ChamaileonVariable[],
  name: string,
): ChamaileonVariable | undefined {
  let byName = variablesByName.get(variables);
  if (!byName) {
    byName = new Map();
    for (const variable of variables) {
      const name = variable.name;
      if (typeof name === "string" && !byName.has(name)) {
        byName.set(name, variable);
      }
    }
    variablesByName.set(variables, byName);
  }
  return byName.get(name);
}

export function unwrapValue(
  value: unknown,
  variables: ChamaileonVariable[],
  stats?: { resolvedVariables: number },
): unknown {
  if (!isVariableObject(value)) return value;
  const resolved = !isUnset(value.default)
    ? value.default
    : (() => {
        const ref =
          typeof value.reference === "string" ? value.reference : undefined;
        if (!ref) return undefined;
        const found = findVariable(variables, ref);
        return found && !isUnset(found.value) ? found.value : undefined;
      })();
  if (stats && !isUnset(resolved)) stats.resolvedVariables += 1;
  return resolved;
}

function readMap(
  raw: Record<string, unknown> | undefined,
  variables: ChamaileonVariable[],
  stats?: { resolvedVariables: number },
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    const unwrapped = unwrapValue(value, variables, stats);
    if (isUnset(unwrapped)) continue;
    out[camelKey(key)] = unwrapped;
  }
  return out;
}

export function readStyle(
  node: ChamaileonNode,
  variables: ChamaileonVariable[],
  stats?: { resolvedVariables: number },
): Record<string, unknown> {
  return readMap(node.style, variables, stats);
}

export function readAttrs(
  node: ChamaileonNode,
  variables: ChamaileonVariable[],
  stats?: { resolvedVariables: number },
): Record<string, unknown> {
  return readMap(node.attrs, variables, stats);
}

export function styleValue(
  style: Record<string, unknown>,
  key: string,
): unknown {
  return style[camelKey(key)];
}
