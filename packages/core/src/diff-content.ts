import type {
  Block,
  BlockParent,
  BlockLocaleLayer,
  LocalizedText,
  Operation,
  SectionBlock,
  TemplateContent,
} from "@templatical/types";
import { deepEqual, safeClone } from "@templatical/types";

/** Where a block sits, with its container as a comparable key. */
interface Placement {
  block: Block;
  key: string;
  index: number;
}

type Json = Record<string, unknown>;

const ROOT_KEY = "root";
const BLOCK_SKIP: ReadonlySet<string> = new Set([
  "id",
  "type",
  "children",
  "l10n",
]);
const RESIZED_SECTION_SKIP: ReadonlySet<string> = new Set([
  "id",
  "type",
  "children",
  "columns",
  "l10n",
]);
const NO_SKIP: ReadonlySet<string> = new Set();
const SETTINGS_SKIP: ReadonlySet<string> = new Set(["locales", "l10n"]);

function containerKey(parent: BlockParent): string {
  return parent === null
    ? ROOT_KEY
    : JSON.stringify([parent.sectionId, parent.column]);
}

function columnsOf(block: Block): Block[][] {
  const children = (block as { children?: unknown }).children;
  return block.type === "section" && Array.isArray(children)
    ? (children as Block[][])
    : [];
}

/** Every block by id, with its container. The first occurrence of an id wins. */
function indexBlocks(blocks: Block[]): Map<string, Placement> {
  const placements = new Map<string, Placement>();
  const walk = (list: Block[], parent: BlockParent): void => {
    list.forEach((block, index) => {
      if (!placements.has(block.id)) {
        placements.set(block.id, { block, key: containerKey(parent), index });
      }
      columnsOf(block).forEach((column, columnIndex) => {
        if (Array.isArray(column)) {
          walk(column, { sectionId: block.id, column: columnIndex });
        }
      });
    });
  };
  walk(blocks, null);
  return placements;
}

/**
 * The positions in `values` of one longest strictly increasing run: the blocks
 * that can stay where they are while the others move around them.
 */
function longestIncreasingRun(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous: number[] = new Array<number>(values.length).fill(-1);
  values.forEach((value, position) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[tails[middle]] < value) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[position] = tails[low - 1];
    tails[low] = position;
  });
  const run = new Set<number>();
  let position = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (position !== -1) {
    run.add(position);
    position = previous[position];
  }
  return run;
}

/** Keys whose values differ, as `set` and `unset`. `undefined` counts as absent. */
function keyChanges(
  before: Json,
  after: Json,
  skip: ReadonlySet<string>,
): { set: Json; unset: string[] } {
  const set: Json = {};
  const unset: string[] = [];
  for (const key of Object.keys(after)) {
    if (skip.has(key) || after[key] === undefined) continue;
    if (!deepEqual(before[key], after[key])) set[key] = safeClone(after[key]);
  }
  for (const key of Object.keys(before)) {
    if (skip.has(key) || before[key] === undefined) continue;
    if (after[key] === undefined) unset.push(key);
  }
  return { set, unset };
}

/** Changed paths within one language's layer; removed paths reset to the base. */
function layerChanges(
  before: BlockLocaleLayer = {},
  after: BlockLocaleLayer = {},
): Pick<
  Extract<Operation, { op: "updateBlockLocale" }>,
  "text" | "set" | "unset" | "hidden"
> {
  const text = keyChanges(before.text ?? {}, after.text ?? {}, NO_SKIP);
  const set = keyChanges(before.set ?? {}, after.set ?? {}, NO_SKIP);
  const unset = [...new Set([...text.unset, ...set.unset])];
  return {
    ...(Object.keys(text.set).length > 0
      ? { text: text.set as Record<string, LocalizedText> }
      : {}),
    ...(Object.keys(set.set).length > 0 ? { set: set.set } : {}),
    ...(unset.length > 0 ? { unset } : {}),
    ...(before.hidden !== after.hidden
      ? { hidden: after.hidden === true }
      : {}),
  };
}

/**
 * The operations that turn `before` into `after`. Blocks are matched by id, so
 * a drag comes out as a `moveBlock` and a layout change as a `columns` change
 * plus moves, never as deletions and re-additions.
 *
 * `applyOperations(before, diffContent(before, after))` deep-equals `after`
 * when both are well formed: unique ids, sections only at the top level, and
 * each section's `children` as long as its layout's column count. The order is
 * what the engine needs:
 *
 * 1. Deletions that take nothing still needed with them.
 * 2. The top level: additions (a new section carries its new children) and moves.
 * 3. `columns` growth, so new columns exist before blocks move into them.
 * 4. Every section column: additions and moves, out of shrinking columns too.
 * 5. `columns` shrinkage, once the dropped columns are empty.
 * 6. Deletion of sections whose surviving blocks have moved out.
 * 7. Key changes on blocks, then on settings.
 * 8. Added locales, block and settings layers, then removed locales.
 *
 * No operation carries `expect`: an ordinary edit applies over anything that
 * doesn't conflict with it, and locks keep two people off one block.
 */
export function diffContent(
  before: TemplateContent,
  after: TemplateContent,
): Operation[] {
  if (
    before.settings.locale !== after.settings.locale &&
    (before.settings.locales?.length || after.settings.locales?.length)
  )
    return [{ op: "setContent", content: safeClone(after) }];
  const was = indexBlocks(before.blocks);
  const now = indexBlocks(after.blocks);
  const ops: Operation[] = [];

  const typeChanged = (id: string): boolean => {
    const next = now.get(id);
    const previous = was.get(id);
    return (
      next !== undefined &&
      previous !== undefined &&
      next.block.type !== previous.block.type
    );
  };
  const survives = (block: Block): boolean =>
    now.has(block.id) && !typeChanged(block.id);
  const hasSurvivor = (block: Block): boolean =>
    columnsOf(block).some(
      (column) =>
        Array.isArray(column) &&
        column.some(
          (child) =>
            survives(child) || (!typeChanged(child.id) && hasSurvivor(child)),
        ),
    );

  // 1. Every old block's fate: kept, deleted now ("gone"), or deleted once its
  //    survivors have moved out ("deferred"). A block that changed type is
  //    deleted and comes back as a new one.
  const gone = new Set<string>();
  const deferred: string[] = [];
  type Fate = "kept" | "deferred" | "dropped";
  const visit = (block: Block, fate: Fate): void => {
    let childFate: Fate = "kept";
    if (fate === "dropped") {
      gone.add(block.id);
      childFate = "dropped";
    } else if (typeChanged(block.id)) {
      ops.push({ op: "deleteBlock", blockId: block.id });
      gone.add(block.id);
      childFate = "dropped";
    } else if (!now.has(block.id)) {
      if (fate === "deferred") {
        childFate = "deferred";
      } else if (hasSurvivor(block)) {
        deferred.push(block.id);
        childFate = "deferred";
      } else {
        ops.push({ op: "deleteBlock", blockId: block.id });
        gone.add(block.id);
        childFate = "dropped";
      }
    }
    for (const column of columnsOf(block)) {
      if (Array.isArray(column)) {
        for (const child of column) visit(child, childFate);
      }
    }
  };
  for (const block of before.blocks) visit(block, "kept");

  const exists = (id: string): boolean => was.has(id) && !gone.has(id);

  // A new block arrives whole, except that a new section brings only its new
  // children: existing ones move in afterwards.
  const payloadOf = (block: Block): Block => {
    const payload = safeClone(block);
    if (payload.type === "section") {
      payload.children = columnsOf(block).map((column) =>
        Array.isArray(column)
          ? column
              .filter((child) => !exists(child.id))
              .map((child) => safeClone(child))
          : column,
      );
    }
    return payload;
  };

  // Lay out one final container: the longest run of blocks already in order
  // stays, and every other block is placed after its final predecessor.
  const place = (
    parent: BlockParent,
    finalList: Block[],
    arrivedWithParent: (block: Block) => boolean,
  ): void => {
    const key = containerKey(parent);
    const indexes: number[] = [];
    const positions: number[] = [];
    finalList.forEach((block, position) => {
      const previous = was.get(block.id);
      if (exists(block.id) && previous !== undefined && previous.key === key) {
        indexes.push(previous.index);
        positions.push(position);
      }
    });
    const staying = new Set(
      [...longestIncreasingRun(indexes)].map((run) => positions[run]),
    );
    finalList.forEach((block, position) => {
      if (staying.has(position) || arrivedWithParent(block)) return;
      const afterId = position > 0 ? finalList[position - 1].id : null;
      ops.push(
        exists(block.id)
          ? { op: "moveBlock", blockId: block.id, parent, after: afterId }
          : { op: "addBlock", block: payloadOf(block), parent, after: afterId },
      );
    });
  };

  // 2. The top level.
  place(null, after.blocks, () => false);

  const sections = after.blocks.filter(
    (block): block is SectionBlock => block.type === "section",
  );
  const resized = new Set<string>();
  const resize = (grow: boolean): void => {
    for (const section of sections) {
      if (!exists(section.id)) continue;
      const fromCount = columnsOf(was.get(section.id)!.block).length;
      const toCount = columnsOf(section).length;
      if (grow ? toCount > fromCount : toCount < fromCount) {
        ops.push({
          op: "updateBlock",
          blockId: section.id,
          set: { columns: section.columns },
        });
        resized.add(section.id);
      }
    }
  };

  // 3. Growth.
  resize(true);

  // 4. Every column of every section, new sections included.
  for (const section of sections) {
    const isNew = !exists(section.id);
    columnsOf(section).forEach((column, columnIndex) => {
      if (!Array.isArray(column)) return;
      place(
        { sectionId: section.id, column: columnIndex },
        column,
        (child) => isNew && !exists(child.id),
      );
    });
  }

  // 5. Shrinkage.
  resize(false);

  // 6. Sections whose survivors have moved out.
  for (const id of deferred) ops.push({ op: "deleteBlock", blockId: id });

  // 7. Key changes, in document order.
  for (const [id, placement] of now) {
    if (!exists(id)) continue;
    const { set, unset } = keyChanges(
      was.get(id)!.block as unknown as Json,
      placement.block as unknown as Json,
      resized.has(id) ? RESIZED_SECTION_SKIP : BLOCK_SKIP,
    );
    if (Object.keys(set).length === 0 && unset.length === 0) continue;
    ops.push({
      op: "updateBlock",
      blockId: id,
      ...(Object.keys(set).length > 0 ? { set } : {}),
      ...(unset.length > 0 ? { unset } : {}),
    });
  }

  const settings = keyChanges(
    before.settings as unknown as Json,
    after.settings as unknown as Json,
    SETTINGS_SKIP,
  );
  if (Object.keys(settings.set).length > 0 || settings.unset.length > 0) {
    ops.push({
      op: "updateSettings",
      ...(Object.keys(settings.set).length > 0 ? { set: settings.set } : {}),
      ...(settings.unset.length > 0 ? { unset: settings.unset } : {}),
    });
  }

  const previousLocales = new Set(before.settings.locales ?? []);
  const nextLocales = new Set(after.settings.locales ?? []);
  for (const locale of nextLocales) {
    if (!previousLocales.has(locale)) ops.push({ op: "addLocale", locale });
  }
  for (const [id, placement] of now) {
    if (!exists(id)) continue;
    const previous = was.get(id)!.block.l10n ?? {};
    const next = placement.block.l10n ?? {};
    for (const locale of new Set([
      ...Object.keys(previous),
      ...Object.keys(next),
    ])) {
      if (!nextLocales.has(locale)) continue;
      const changes = layerChanges(previous[locale], next[locale]);
      if (Object.keys(changes).length > 0) {
        ops.push({ op: "updateBlockLocale", blockId: id, locale, ...changes });
      }
    }
  }
  const previous = before.settings.l10n ?? {};
  const next = after.settings.l10n ?? {};
  for (const locale of new Set([
    ...Object.keys(previous),
    ...Object.keys(next),
  ])) {
    if (!nextLocales.has(locale)) continue;
    const changes = layerChanges(previous[locale], next[locale]);
    if (Object.keys(changes).length > 0) {
      ops.push({ op: "updateSettingsLocale", locale, ...changes });
    }
  }
  for (const locale of previousLocales) {
    if (!nextLocales.has(locale)) ops.push({ op: "removeLocale", locale });
  }
  return ops;
}
