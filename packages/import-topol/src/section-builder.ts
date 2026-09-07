import { createSectionBlock } from "@templatical/types";
import type { Block, ColumnLayout } from "@templatical/types";
import {
  attr,
  parseColor,
  parsePadding,
  parsePercent,
} from "./attribute-parser";
import { convertLeaf, type MapContext } from "./block-mapper";
import { convertSocial } from "./social-mapper";
import type { ImportReportEntry, TopolNode } from "./types";

const LAYOUT_SHAPES: Array<{ layout: ColumnLayout; percents: number[] }> = [
  { layout: "1", percents: [100] },
  { layout: "2", percents: [50, 50] },
  { layout: "1-2", percents: [33.33, 66.67] },
  { layout: "2-1", percents: [66.67, 33.33] },
  { layout: "3", percents: [33.33, 33.33, 33.34] },
];

const WIDTH_TOLERANCE = 2;

const COLUMN_COUNT: Record<ColumnLayout, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "2-1": 2,
  "1-2": 2,
};

function columnPixels(layout: ColumnLayout, container: number): number[] {
  switch (layout) {
    case "2":
      return [container / 2, container / 2];
    case "3":
      return [container / 3, container / 3, container / 3];
    case "1-2":
      return [container / 3, (container * 2) / 3];
    case "2-1":
      return [(container * 2) / 3, container / 3];
    default:
      return [container];
  }
}

/**
 * Resolve column widths to one of the five layouts `ColumnLayout` allows.
 *
 * `exact: false` means the caller reports `approximated` — Topol permits any
 * column count at any width and this union permits five shapes, so this is the
 * importer's main irreducible loss.
 */
export function matchColumnLayout(percents: Array<number | null>): {
  layout: ColumnLayout;
  exact: boolean;
} {
  const count = percents.length;
  if (count === 0) return { layout: "1", exact: true };

  // All-unset is "distribute equally", which is exactly what the n-column
  // layout means — not a missing value to approximate around.
  if (percents.every((p) => p === null)) {
    if (count === 1) return { layout: "1", exact: true };
    if (count === 2) return { layout: "2", exact: true };
    if (count === 3) return { layout: "3", exact: true };
    return { layout: "3", exact: false };
  }

  const known = percents.filter((p): p is number => p !== null);
  const unsetCount = count - known.length;
  const remainder =
    unsetCount === 0
      ? 0
      : Math.max(0, 100 - known.reduce((a, b) => a + b, 0)) / unsetCount;
  const resolved = percents.map((p) => p ?? remainder);

  const sameCount = LAYOUT_SHAPES.filter((s) => s.percents.length === count);

  for (const shape of sameCount) {
    if (
      shape.percents.every(
        (want, i) => Math.abs(want - resolved[i]) <= WIDTH_TOLERANCE,
      )
    ) {
      return { layout: shape.layout, exact: true };
    }
  }

  const candidates =
    sameCount.length > 0
      ? sameCount
      : LAYOUT_SHAPES.filter((s) => s.layout === "3");

  let best = candidates[0];
  let bestError = Infinity;
  for (const shape of candidates) {
    const error = shape.percents.reduce(
      (sum, want, i) => sum + Math.abs(want - (resolved[i] ?? 0)),
      0,
    );
    if (error < bestError) {
      bestError = error;
      best = shape;
    }
  }

  return { layout: best.layout, exact: false };
}

function convertColumnChildren(
  column: TopolNode,
  ctx: MapContext,
  entries: ImportReportEntry[],
): Block[] {
  const blocks: Block[] = [];
  for (const child of column.children ?? []) {
    const converted =
      child.tagName === "mj-social"
        ? convertSocial(child, ctx)
        : convertLeaf(child, ctx);
    if (!converted) continue;
    entries.push(converted.entry);
    if (converted.block) blocks.push(converted.block);
  }
  return blocks;
}

/**
 * Build a `SectionBlock` from an `mj-section`. Returns an array so the caller
 * can treat an empty section (no columns) as producing nothing.
 *
 * Reads `attributes` only. The node's top-level camelCase keys
 * (`backgroundColor`, `paddingTop`, …) are stale editor state that disagrees
 * with `attributes` in every measured case.
 */
export function buildSection(
  node: TopolNode,
  ctx: MapContext,
  entries: ImportReportEntry[],
): Block[] {
  const columns = (node.children ?? []).filter(
    (c) => c.tagName === "mj-column",
  );
  if (columns.length === 0) return [];

  const rawWidths = columns.map((c) => attr(c, "width"));
  const percents = rawWidths.map((w) => parsePercent(w));
  const { layout, exact } = matchColumnLayout(percents);

  const slots = COLUMN_COUNT[layout];
  const pixels = columnPixels(layout, ctx.style.settings.width);
  const children: Block[][] = Array.from({ length: slots }, () => []);

  entries.push({
    sourceTag: "mj-section",
    templaticalBlockType: "section",
    status: exact ? "converted" : "approximated",
    ...(exact
      ? {}
      : {
          note: `Column widths ${rawWidths.map((w) => w ?? "auto").join(", ")} have no exact Templatical layout; resolved to "${layout}".`,
        }),
  });

  columns.forEach((column, index) => {
    const slot = Math.min(index, slots - 1);
    const columnCtx: MapContext = {
      ...ctx,
      columnWidth: Math.round(pixels[slot] ?? ctx.style.settings.width),
    };
    children[slot].push(...convertColumnChildren(column, columnCtx, entries));
  });

  const backgroundColor = parseColor(attr(node, "background-color"));

  return [
    createSectionBlock({
      columns: layout,
      children,
      styles: {
        padding: parsePadding(node),
        ...(backgroundColor ? { backgroundColor } : {}),
      },
    }),
  ];
}
