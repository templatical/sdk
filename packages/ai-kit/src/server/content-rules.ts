/**
 * Every block in a list, at any depth, depth first. A section's children are
 * columns (lists of blocks) and a wrapper's are blocks, so any list is walked
 * and any object is a block (S8's `McpContentRules::walk`).
 */
export function walkBlocks(nodes: unknown): Record<string, unknown>[] {
  if (!Array.isArray(nodes)) return [];
  const blocks: Record<string, unknown>[] = [];
  for (const node of nodes) {
    if (Array.isArray(node)) {
      blocks.push(...walkBlocks(node));
    } else if (typeof node === "object" && node !== null) {
      const block = node as Record<string, unknown>;
      blocks.push(block, ...walkBlocks(block.children));
    }
  }
  return blocks;
}

/** `custom, slot or wrapper` */
function list(types: readonly string[]): string {
  return types.length <= 1
    ? (types[0] ?? "")
    : `${types.slice(0, -1).join(", ")} or ${types.at(-1)}`;
}

/**
 * Why an AI may not write these blocks into content holding `existing` blocks,
 * or `null` when it may: a forbidden type that isn't already there (a replace
 * may keep the ones that are).
 */
export function contentRuleRefusal(
  blocks: unknown,
  existing: ReadonlyMap<string, Record<string, unknown>>,
  forbidden: readonly string[],
): string | null {
  for (const block of walkBlocks(blocks)) {
    const previous =
      typeof block.id === "string" ? existing.get(block.id) : undefined;
    if (
      previous &&
      previous.type === block.type &&
      (block.type !== "custom" || previous.customType === block.customType)
    )
      continue;
    if (typeof block.type === "string" && forbidden.includes(block.type)) {
      return `you can't add ${list(forbidden)} blocks`;
    }
  }
  return null;
}

/** Keep an existing block's identity and custom schema while editing its fields. */
export function updateBlockRuleRefusal(
  operation: Record<string, unknown>,
  existing: ReadonlyMap<string, Record<string, unknown>>,
): string | null {
  const previous =
    typeof operation.blockId === "string"
      ? existing.get(operation.blockId)
      : undefined;
  if (!previous) return null;
  const set =
    typeof operation.set === "object" && operation.set !== null
      ? (operation.set as Record<string, unknown>)
      : {};
  const unset = Array.isArray(operation.unset) ? operation.unset : [];
  for (const key of previous.type === "custom"
    ? ["type", "customType"]
    : ["type"]) {
    if (
      (Object.hasOwn(set, key) && set[key] !== previous[key]) ||
      unset.includes(key)
    )
      return `you can't change a block's ${key}`;
  }
  return null;
}
