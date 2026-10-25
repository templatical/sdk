import type { Block } from "./blocks";
import { safeClone } from "./clone";
import type { BlockLocaleLayer, LocalizedText } from "./localization";
import {
  applyOperationsInPlace,
  OperationError,
  type BlockParent,
  type Operation,
  type LocaleLayerExpect,
  type UpdateBlockLocaleOperation,
  type UpdateSettingsLocaleOperation,
} from "./operations";
import type { TemplateContent } from "./template";

type Json = Record<string, unknown>;

interface Position {
  block: Block;
  parent: BlockParent;
  /** The previous sibling's id, or `null` when the block is first. */
  after: string | null;
}

function columnsOf(block: Block): Block[][] {
  const children = (block as { children?: unknown }).children;
  return block.type === "section" && Array.isArray(children)
    ? (children as Block[][])
    : [];
}

function positionOf(
  blocks: Block[],
  blockId: string,
  parent: BlockParent = null,
): Position | null {
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.id === blockId) {
      return { block, parent, after: index > 0 ? blocks[index - 1].id : null };
    }
    const columns = columnsOf(block);
    for (let column = 0; column < columns.length; column++) {
      if (!Array.isArray(columns[column])) continue;
      const found = positionOf(columns[column], blockId, {
        sectionId: block.id,
        column,
      });
      if (found) return found;
    }
  }
  return null;
}

function requirePosition(
  state: TemplateContent,
  blockId: string,
  index: number,
): Position {
  const position = positionOf(state.blocks, blockId);
  if (!position) {
    throw new OperationError(
      "block_missing",
      index,
      `No block with id "${blockId}".`,
      blockId,
    );
  }
  return position;
}

/** Put back the keys an update touched, expecting what the update left. */
function restoreKeys(
  current: Json,
  set: Json | undefined,
  unset: readonly string[] | undefined,
): { set: Json; unset: string[]; expect: Json } {
  const restore: Json = {};
  const remove: string[] = [];
  const expect: Json = {};
  const keys = [...new Set([...Object.keys(set ?? {}), ...(unset ?? [])])];
  for (const key of keys) {
    const previous = current[key];
    if (previous === undefined) remove.push(key);
    else restore[key] = safeClone(previous);
    const next = set && key in set ? set[key] : undefined;
    expect[key] = next === undefined ? null : safeClone(next);
  }
  return { set: restore, unset: remove, expect };
}

function layerOf(
  target: { l10n?: Record<string, BlockLocaleLayer> },
  locale: string,
): BlockLocaleLayer {
  return target.l10n?.[locale] ?? {};
}

function restoreLocale(
  previous: BlockLocaleLayer,
  next: BlockLocaleLayer,
  paths: string[],
  hidden: boolean,
): {
  unset: string[];
  text?: Record<string, LocalizedText>;
  set?: Json;
  hidden?: boolean;
  expect: LocaleLayerExpect;
} {
  const text: Record<string, LocalizedText> = {};
  const set: Json = {};
  const expect: LocaleLayerExpect = {};
  if (paths.length) {
    expect.text = {};
    expect.set = {};
  }
  for (const path of paths) {
    if (previous.text?.[path] !== undefined)
      text[path] = safeClone(previous.text[path]);
    if (previous.set && Object.hasOwn(previous.set, path))
      set[path] = safeClone(previous.set[path]);
    expect.text![path] = safeClone(next.text?.[path] ?? null);
    expect.set![path] = safeClone(next.set?.[path] ?? null);
  }
  if (hidden) expect.hidden = next.hidden === true;
  return {
    unset: paths,
    ...(Object.keys(text).length ? { text } : {}),
    ...(Object.keys(set).length ? { set } : {}),
    ...(hidden ? { hidden: previous.hidden === true } : {}),
    expect,
  };
}

function restoreRemovedLayer(
  layer: BlockLocaleLayer,
): Omit<UpdateBlockLocaleOperation, "op" | "blockId" | "locale"> {
  const paths = [
    ...new Set([
      ...Object.keys(layer.text ?? {}),
      ...Object.keys(layer.set ?? {}),
    ]),
  ];
  const restored = restoreLocale(layer, {}, paths, layer.hidden === true);
  const { unset: _unset, ...changes } = restored;
  return changes;
}

function blocksIn(blocks: Block[]): Block[] {
  return blocks.flatMap((block) => [
    block,
    ...columnsOf(block).flatMap(blocksIn),
  ]);
}

function invertOne(
  state: TemplateContent,
  op: Operation,
  index: number,
): Operation | Operation[] {
  switch (op.op) {
    case "addBlock":
      return {
        op: "deleteBlock",
        blockId: op.block.id,
        expect: { block: safeClone(op.block) },
      };
    case "deleteBlock": {
      const position = requirePosition(state, op.blockId, index);
      return {
        op: "addBlock",
        block: safeClone(position.block),
        parent: position.parent,
        after: position.after,
      };
    }
    case "moveBlock": {
      const position = requirePosition(state, op.blockId, index);
      return {
        op: "moveBlock",
        blockId: op.blockId,
        parent: position.parent,
        after: position.after,
        expect: { parent: op.parent, after: op.after },
      };
    }
    case "updateBlock": {
      const block = requirePosition(state, op.blockId, index)
        .block as unknown as Json;
      const { set, unset, expect } = restoreKeys(block, op.set, op.unset);
      return {
        op: "updateBlock",
        blockId: op.blockId,
        ...(Object.keys(set).length > 0 ? { set } : {}),
        ...(unset.length > 0 ? { unset } : {}),
        expect,
      };
    }
    case "updateSettings": {
      const { set, unset, expect } = restoreKeys(
        state.settings as unknown as Json,
        op.set as Json | undefined,
        op.unset,
      );
      return {
        op: "updateSettings",
        ...(Object.keys(set).length > 0 ? { set } : {}),
        ...(unset.length > 0 ? { unset } : {}),
        expect,
      };
    }
    case "addLocale":
      return { op: "removeLocale", locale: op.locale, expect: { blocks: {} } };
    case "removeLocale": {
      const inverse: Operation[] = [
        {
          op: "addLocale",
          locale: op.locale,
          position: state.settings.locales?.indexOf(op.locale),
        },
      ];
      for (const block of blocksIn(state.blocks)) {
        const layer = block.l10n?.[op.locale];
        if (layer)
          inverse.push({
            op: "updateBlockLocale",
            blockId: block.id,
            locale: op.locale,
            ...restoreRemovedLayer(layer),
          });
      }
      const layer = state.settings.l10n?.[op.locale];
      if (layer) {
        const { hidden: _hidden, ...changes } = restoreRemovedLayer(layer);
        inverse.push({
          op: "updateSettingsLocale",
          locale: op.locale,
          ...changes,
        });
      }
      return inverse;
    }
    case "updateBlockLocale":
    case "updateSettingsLocale": {
      const next = safeClone(state);
      applyOperationsInPlace(next, [op]);
      const paths = [
        ...new Set([
          ...Object.keys(op.text ?? {}),
          ...Object.keys(op.set ?? {}),
          ...(op.unset ?? []),
        ]),
      ];
      if (op.op === "updateBlockLocale") {
        const previous = requirePosition(state, op.blockId, index).block;
        const after = requirePosition(next, op.blockId, index).block;
        return {
          op: "updateBlockLocale",
          blockId: op.blockId,
          locale: op.locale,
          ...restoreLocale(
            layerOf(previous, op.locale),
            layerOf(after, op.locale),
            paths,
            op.hidden !== undefined,
          ),
        };
      }
      const { hidden: _hidden, ...changes } = restoreLocale(
        layerOf(state.settings, op.locale),
        layerOf(next.settings, op.locale),
        paths,
        false,
      );
      return {
        op: "updateSettingsLocale",
        locale: op.locale,
        ...changes,
      } as UpdateSettingsLocaleOperation;
    }
    case "setContent":
      return {
        op: "setContent",
        content: {
          blocks: safeClone(state.blocks),
          settings: safeClone(state.settings),
        },
      };
  }
}

/**
 * The batch that undoes `ops`, given the content they apply to. Each operation
 * is inverted against the content just before it, and the inverses run in
 * reverse order.
 *
 * Every inverse that can be guarded is: it expects what its operation left
 * behind, so an undo that a later edit by someone else has overtaken is refused
 * (`precondition_failed`, `anchor_missing`, `block_missing`) instead of
 * overwriting that edit. A `setContent` inverse has no guard; the backend's
 * `locked_by_others` rule is what stops it while others are editing.
 *
 * Throws the engine's `OperationError` when `ops` don't apply to `before`.
 */
export function invertOperations(
  before: TemplateContent,
  ops: readonly Operation[],
): Operation[] {
  const state = safeClone(before);
  const inverses: Operation[] = [];
  ops.forEach((op, index) => {
    try {
      const inverse = invertOne(state, op, index);
      inverses.push(
        ...(Array.isArray(inverse) ? [...inverse].reverse() : [inverse]),
      );
      applyOperationsInPlace(state, [op]);
    } catch (error) {
      if (!(error instanceof OperationError)) throw error;
      // Applied one at a time, so the engine numbers it 0: give it its index.
      throw new OperationError(error.code, index, error.message, error.blockId);
    }
  });
  return inverses.reverse();
}
