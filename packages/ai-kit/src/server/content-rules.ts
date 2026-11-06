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
 * A locale may not change block type or custom schema or add forbidden children.
 * A localized child keeps the type of the block with its id, in the layer's own
 * base children or elsewhere in the content.
 */
export function localeLayerRuleRefusal(
  block: Record<string, unknown>,
  layer: unknown,
  existing: ReadonlyMap<string, Record<string, unknown>>,
  forbidden: readonly string[],
  base: ReadonlyMap<string, Record<string, unknown>> = childrenById(block),
): string | null {
  if (typeof layer !== "object" || layer === null) return null;
  const { set, text } = layer as Record<string, unknown>;
  const setFields =
    typeof set === "object" && set !== null
      ? (set as Record<string, unknown>)
      : {};
  const textFields =
    typeof text === "object" && text !== null
      ? (text as Record<string, unknown>)
      : {};
  if (Object.hasOwn(setFields, "type") || Object.hasOwn(textFields, "type"))
    return "you can't change a block's type";
  if (
    (Object.hasOwn(setFields, "customType") &&
      setFields.customType !== block.customType) ||
    (Object.hasOwn(textFields, "customType") &&
      (textFields.customType as { value?: unknown } | null)?.value !==
        block.customType)
  )
    return "you can't change a block's customType";
  for (const child of walkBlocks(setFields.children)) {
    if (typeof child.id !== "string") continue;
    const original = base.get(child.id) ?? existing.get(child.id);
    if (original !== undefined && original.type !== child.type)
      return "you can't change a block's type";
  }
  return contentRuleRefusal(setFields.children, existing, forbidden);
}

/** Every block under `block`, by id. */
function childrenById(
  block: Record<string, unknown>,
): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const child of walkBlocks(block.children)) {
    if (typeof child.id === "string") byId.set(child.id, child);
  }
  return byId;
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
      typeof block.type === "string" &&
      forbidden.includes(block.type) &&
      !(
        previous &&
        previous.type === block.type &&
        (block.type !== "custom" || previous.customType === block.customType)
      )
    ) {
      return `you can't add ${list(forbidden)} blocks`;
    }
    if (typeof block.l10n === "object" && block.l10n !== null) {
      const base = childrenById(block);
      for (const layer of Object.values(block.l10n)) {
        const reason = localeLayerRuleRefusal(
          block,
          layer,
          existing,
          forbidden,
          base,
        );
        if (reason !== null) return reason;
      }
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
