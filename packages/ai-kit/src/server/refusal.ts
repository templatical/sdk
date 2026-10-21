import type {
  Operation,
  OperationError,
  TemplateContent,
} from "@templatical/types";
import { applyOperations, deepEqual } from "@templatical/types";

/** "updateBlock b-1", "addBlock b-9", "updateSettings", or "unknown". */
export function describeOp(op: unknown): string {
  if (typeof op !== "object" || op === null) return "unknown";
  const { op: kind, blockId, block } = op as Record<string, unknown>;
  if (typeof kind !== "string") return "unknown";
  const target =
    kind === "addBlock"
      ? (block as { id?: unknown } | undefined)?.id
      : kind === "moveBlock" || kind === "deleteBlock" || kind === "updateBlock"
        ? blockId
        : undefined;
  return typeof target === "string" ? `${kind} ${target}` : kind;
}

/** "op 2 (updateBlock b-1) was refused: …", numbered from 0 like `opIndex`. */
export function opRefusal(index: number, op: unknown, reason: string): string {
  return `op ${index} (${describeOp(op)}) was refused: ${reason}`;
}

const VALUE_MAX_CHARS = 200;

function show(value: unknown): string {
  const shown = typeof value === "string" ? value : JSON.stringify(value);
  return shown.length > VALUE_MAX_CHARS
    ? `${shown.slice(0, VALUE_MAX_CHARS)}…`
    : shown;
}

/** The block, its parent and previous sibling, or `null`. */
function locate(
  content: TemplateContent,
  blockId: unknown,
): {
  block: Record<string, unknown>;
  parent: unknown;
  after: string | null;
} | null {
  if (typeof blockId !== "string") return null;
  const search = (
    blocks: unknown[],
    parent: unknown,
  ): ReturnType<typeof locate> => {
    let previous: string | null = null;
    for (const node of blocks) {
      const block = node as Record<string, unknown>;
      if (block.id === blockId) return { block, parent, after: previous };
      if (block.type === "section" && Array.isArray(block.children)) {
        for (const [column, children] of (
          block.children as unknown[]
        ).entries()) {
          if (!Array.isArray(children)) continue;
          const found = search(children, { sectionId: block.id, column });
          if (found) return found;
        }
      }
      previous = typeof block.id === "string" ? block.id : previous;
    }
    return null;
  };
  return search(Array.isArray(content.blocks) ? content.blocks : [], null);
}

/** What an operation's `expect` is compared with now. */
function currentValues(
  content: TemplateContent,
  op: Record<string, unknown>,
): Record<string, unknown> | null {
  const location = locate(content, op.blockId);
  switch (op.op) {
    case "updateBlock":
      return location?.block ?? null;
    case "updateSettings":
      return (content.settings as unknown as Record<string, unknown>) ?? null;
    case "moveBlock":
      return location
        ? { parent: location.parent, after: location.after }
        : null;
    case "deleteBlock":
      return location ? { block: location.block } : null;
    default:
      return null;
  }
}

/** The first path where `expected` and `actual` differ: [path, value, set?]. */
function firstDifference(
  expected: unknown,
  actual: unknown,
  present: boolean,
  path: string,
): [string, unknown, boolean] {
  if (
    typeof expected === "object" &&
    expected !== null &&
    !Array.isArray(expected) &&
    typeof actual === "object" &&
    actual !== null &&
    !Array.isArray(actual)
  ) {
    const e = expected as Record<string, unknown>;
    const a = actual as Record<string, unknown>;
    for (const key of new Set([...Object.keys(e), ...Object.keys(a)])) {
      const has = Object.hasOwn(a, key);
      if (Object.hasOwn(e, key) !== has || !deepEqual(e[key], a[key])) {
        return firstDifference(e[key], a[key], has, `${path}.${key}`);
      }
    }
  }
  return [path, actual, present];
}

/** "level is now 1": what the refused op's `expect` finds now (S8's sentence). */
function mismatch(
  content: TemplateContent,
  ops: unknown[],
  index: number,
): string {
  const op = ops[index] as Record<string, unknown> | undefined;
  const expect = op?.expect;
  if (!op || typeof expect !== "object" || expect === null)
    return "the template changed";
  let before: TemplateContent;
  try {
    before = applyOperations(content, ops.slice(0, index) as Operation[]);
  } catch {
    return "the template changed";
  }
  const current = currentValues(before, op);
  if (!current) return "the template changed";
  const expectedValues = expect as Record<string, unknown>;
  const normalized =
    op.op === "moveBlock"
      ? {
          parent: expectedValues.parent ?? null,
          after: expectedValues.after ?? null,
        }
      : expectedValues;
  for (const [key, expected] of Object.entries(normalized)) {
    const present = Object.hasOwn(current, key);
    const actual = present ? current[key] : null;
    if (expected === null && (actual === null || actual === undefined))
      continue;
    if (!deepEqual(actual, expected)) {
      const [path, value, isSet] = firstDifference(
        expected,
        actual,
        present,
        key,
      );
      return isSet ? `${path} is now ${show(value)}` : `${path} is now unset`;
    }
  }
  return "the template changed";
}

/** A lock as the session knows it, with the holder's name. */
export interface NamedLock {
  blockId: string;
  sessionId: string;
  name: string;
}

/** The engine's refusal as a sentence the model can act on. */
export function engineRefusal(
  error: OperationError,
  ops: unknown[],
  content: TemplateContent,
  locks: readonly NamedLock[],
  sessionId: string | null,
): string {
  if (error.code === "precondition_failed") {
    return `op ${error.opIndex}'s expect failed: ${mismatch(content, ops, error.opIndex)}`;
  }
  const others = locks.filter((lock) => lock.sessionId !== sessionId);
  let reason: string;
  if (error.code === "lock_held") {
    const holder = others.find((lock) => lock.blockId === error.blockId);
    reason = `${holder?.name ?? "someone"} is editing this block`;
  } else if (error.code === "locked_by_others") {
    const names = [...new Set(others.map((lock) => lock.name))];
    reason =
      names.length === 0
        ? "someone is editing blocks in this template"
        : `${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`} ${names.length === 1 ? "is" : "are"} editing blocks in this template`;
  } else {
    reason =
      error.message.charAt(0).toLowerCase() +
      error.message.slice(1).replace(/\.$/, "");
  }
  return opRefusal(error.opIndex, ops[error.opIndex], reason);
}
