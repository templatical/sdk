import {
  OperationError,
  applyOperations,
  localizeBlock,
  defaultLocaleOf,
  pruneLocaleOrphans,
  readPath,
  resolveLocale,
  safeClone,
  type Block,
  type BlockLocaleLayer,
  type BlockParent,
  type CustomBlockDefinition,
  type Operation,
  type TemplateContent,
} from "@templatical/types";
import { diffContent } from "./diff-content";
import {
  changedLayer,
  deriveLayer,
  deriveSettingsLayer,
  reconcileStructure,
} from "./localized-edit";

interface Lifetime {
  initial: Block;
  added: boolean;
  changed: boolean;
}

function indexBlocks(blocks: Block[]): Map<string, Block> {
  const result = new Map<string, Block>();
  const visit = (block: Block): void => {
    result.set(block.id, block);
    if (block.type === "section") block.children.flat().forEach(visit);
  };
  blocks.forEach(visit);
  return result;
}

function container(content: TemplateContent, parent: BlockParent): Block[] {
  if (parent === null) return content.blocks;
  const section = indexBlocks(content.blocks).get(parent.sectionId)!;
  return section.type === "section" ? section.children[parent.column] : [];
}

function placement(
  content: TemplateContent,
  id: string,
): {
  parent: BlockParent;
  after: string | null;
} {
  const find = (
    blocks: Block[],
    parent: BlockParent,
  ): ReturnType<typeof placement> | undefined => {
    const index = blocks.findIndex((block) => block.id === id);
    if (index >= 0) return { parent, after: blocks[index - 1]?.id ?? null };
    for (const block of blocks) {
      if (block.type !== "section") continue;
      for (const [column, children] of block.children.entries()) {
        const result = find(children, { sectionId: block.id, column });
        if (result) return result;
      }
    }
  };
  return find(content.blocks, null)!;
}

/** Keep leading hidden siblings before an insertion at the first visible slot. */
function sharedAfter(
  shared: TemplateContent,
  view: TemplateContent,
  parent: BlockParent,
  after: string | null,
  moving?: string,
): string | null {
  if (after !== null) return after;
  const visible = container(view, parent).find((block) => block.id !== moving);
  const siblings = container(shared, parent).filter(
    (block) => block.id !== moving,
  );
  const index = visible
    ? siblings.findIndex((block) => block.id === visible.id)
    : siblings.length;
  return siblings[index - 1]?.id ?? null;
}

function writeLayer(
  target: { l10n?: Record<string, BlockLocaleLayer> },
  locale: string,
  layer: BlockLocaleLayer,
): void {
  if (Object.keys(layer).length) (target.l10n ??= {})[locale] = layer;
  else if (target.l10n) {
    delete target.l10n[locale];
    if (!Object.keys(target.l10n).length) delete target.l10n;
  }
}

function stripLayers(block: Block): Block {
  const result = safeClone(block);
  delete result.l10n;
  if (result.type === "section")
    result.children = result.children.map((column) => column.map(stripLayers));
  return result;
}

/**
 * Turn operations written against `resolveLocale(base, locale)` into
 * operations on `base`: changed translatable text becomes `text` (stamped
 * with the base value's hash), other changed properties become `set`,
 * structure changes go to the shared tree (a new block's values become
 * default values, as a paste in that view does). Throws the engine's
 * OperationError when `ops` don't apply to the projection or include a
 * whole-template `setContent` replacement.
 */
export function mapLocalizedOperations(
  base: TemplateContent,
  locale: string,
  ops: Operation[],
  definitions?: readonly CustomBlockDefinition[],
): Operation[] {
  let view = resolveLocale(base, locale);
  let shared = safeClone(base);
  const initialSettings = safeClone(view.settings);
  let settingsChanged = false;
  const lifetimes = new Map<string, Lifetime>();
  const register = (blocks: Block[], added: boolean): void => {
    for (const [id, block] of indexBlocks(blocks))
      lifetimes.set(id, {
        initial: localizeBlock(block, locale, defaultLocaleOf(base)),
        added,
        changed: false,
      });
  };
  register(view.blocks, false);
  const mapped: Operation[] = [];
  const applyAt = (
    content: TemplateContent,
    operations: Operation[],
    index: number,
  ): TemplateContent => {
    if (operations.some((operation) => operation?.op === "setDefaultLocale"))
      throw new OperationError(
        "invalid_operation",
        index,
        "Changing the default language isn't possible in a language view; switch to the default language.",
      );
    if (operations.some((operation) => operation?.op === "setContent"))
      throw new OperationError(
        "invalid_operation",
        index,
        "Replacing the whole template isn't possible in a language view; switch to the default language.",
      );
    try {
      return applyOperations(content, operations);
    } catch (error) {
      if (error instanceof OperationError)
        throw new OperationError(
          error.code,
          index,
          error.message,
          error.blockId,
        );
      throw error;
    }
  };
  const emit = (operations: Operation[], index: number): void => {
    shared = applyAt(shared, operations, index);
    mapped.push(...operations);
  };
  const flush = (id: string, index: number): void => {
    const lifetime = lifetimes.get(id);
    if (!lifetime?.changed) return;
    const block = indexBlocks(shared.blocks).get(id)!;
    const final = indexBlocks(view.blocks).get(id)!;
    const next = safeClone(shared);
    const position = placement(next, id);
    const siblings = container(next, position.parent);
    let target = safeClone(block);
    if (lifetime.added) {
      target = stripLayers(final);
      if (target.type === "section" && block.type === "section") {
        target.children = block.children;
        target.columns = block.columns;
      }
    } else {
      const structuralView =
        target.type === "section"
          ? ({
              ...final,
              children: target.children,
              columns: target.columns,
            } as Block)
          : final;
      reconcileStructure(
        target,
        structuralView,
        (blockId) => indexBlocks(shared.blocks).get(blockId) ?? null,
      );
      target = pruneLocaleOrphans(target);
      const previous = target.l10n?.[locale];
      writeLayer(
        target,
        locale,
        changedLayer(
          previous,
          deriveLayer(target, lifetime.initial, previous, definitions),
          deriveLayer(target, final, previous, definitions),
          target,
          final,
        ),
      );
    }
    siblings[siblings.findIndex((candidate) => candidate.id === id)] = target;
    emit(diffContent(shared, next), index);
    lifetime.changed = false;
  };
  const resize = (
    op: Extract<Operation, { op: "updateBlock" }>,
    after: TemplateContent,
    index: number,
  ): void => {
    const section = indexBlocks(shared.blocks).get(op.blockId)!;
    const projected = indexBlocks(after.blocks).get(op.blockId)!;
    if (
      section.type !== "section" ||
      projected.type !== "section" ||
      section.columns === projected.columns
    )
      return;
    const count = projected.children.length;
    // Build the kept columns first; hidden overflow follows the last kept child.
    const kept = section.children.slice(0, count);
    const overflow = section.children.slice(count).flat();
    const target = [...(kept[count - 1] ?? []), ...overflow];
    for (const [offset, block] of overflow.entries())
      emit(
        [
          {
            op: "moveBlock",
            blockId: block.id,
            parent: { sectionId: section.id, column: count - 1 },
            after:
              target[target.length - overflow.length + offset - 1]?.id ?? null,
          },
        ],
        index,
      );
    const current = indexBlocks(shared.blocks).get(op.blockId)!;
    emit(
      [
        {
          op: "updateBlock",
          blockId: op.blockId,
          set: { columns: projected.columns },
          ...(op.expect
            ? {
                expect: Object.fromEntries(
                  Object.keys(op.expect).map((key) => [
                    key,
                    readPath(current, key) ?? null,
                  ]),
                ),
              }
            : {}),
        },
      ],
      index,
    );
  };
  const mapOne = (op: Operation, index: number): void => {
    // The projection omits the language versions that make locale immutable.
    if (
      op?.op === "updateSettings" &&
      (Object.hasOwn(op.set ?? {}, "locale") ||
        (Array.isArray(op.unset) && op.unset.includes("locale")))
    )
      applyAt(shared, [op], index);
    // Other guards see the input projection; every refusal names its input index.
    const after = applyAt(view, [op], index);
    switch (op.op) {
      case "addBlock": {
        const block = stripLayers(op.block);
        emit(
          [
            {
              ...op,
              block,
              after: sharedAfter(shared, view, op.parent, op.after),
            },
          ],
          index,
        );
        register([block], true);
        break;
      }
      case "moveBlock":
        emit(
          [
            {
              ...op,
              after: sharedAfter(shared, view, op.parent, op.after, op.blockId),
              ...(op.expect ? { expect: placement(shared, op.blockId) } : {}),
            },
          ],
          index,
        );
        break;
      case "deleteBlock": {
        const ids = [
          ...indexBlocks([indexBlocks(shared.blocks).get(op.blockId)!]).keys(),
        ];
        for (const id of ids) flush(id, index);
        emit([{ op: "deleteBlock", blockId: op.blockId }], index);
        for (const id of ids) lifetimes.delete(id);
        break;
      }
      case "updateBlock":
        resize(op, after, index);
        lifetimes.get(op.blockId)!.changed = true;
        break;
      case "updateSettings":
        settingsChanged = true;
        break;
      default:
        emit([op], index);
    }
    view = after;
  };
  ops.forEach(mapOne);
  for (const id of lifetimes.keys()) flush(id, ops.length - 1);
  if (settingsChanged) {
    const next = safeClone(shared);
    const previous = next.settings.l10n?.[locale];
    writeLayer(
      next.settings,
      locale,
      changedLayer(
        previous,
        deriveSettingsLayer(next.settings, initialSettings, previous),
        deriveSettingsLayer(next.settings, view.settings, previous),
        next.settings,
        view.settings,
      ),
    );
    emit(diffContent(shared, next), ops.length - 1);
  }
  return mapped;
}
