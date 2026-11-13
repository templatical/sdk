import {
  COLUMN_LAYOUT_PERCENTS,
  columnWidthsIssue,
  createSectionBlock,
  sectionColumnPercents,
} from "@templatical/types";
import type { Block, ColumnLayout } from "@templatical/types";
import {
  attr,
  parseColor,
  parsePadding,
  parsePercent,
  readMjmlBackgroundImage,
} from "./attribute-parser";
import { convertLeaf, type MapContext } from "./block-mapper";
import { convertSocial } from "./social-mapper";
import type { ImportReportEntry, TopolNode } from "./types";

/** Preset match order. The first preset within the tolerance wins. */
const LAYOUT_MATCH_ORDER: readonly ColumnLayout[] = [
  "1",
  "2",
  "1-2",
  "2-1",
  "1-3",
  "3-1",
  "3",
  "1-2-1",
  "4",
];

/** Percentage points of drift tolerated per column before a match is inexact. */
const WIDTH_TOLERANCE = 2;

/**
 * One hundredth, the step `sectionColumnPercents` rounds to, plus the float
 * error of subtracting two hundredths. Scaled shares this close to a preset
 * are that preset.
 */
const SCALED_TOLERANCE = 0.01 + 1e-9;

function evenLayout(count: number): ColumnLayout {
  if (count === 3) return "3";
  if (count === 4) return "4";
  return "2";
}

/** The first preset with one share per value, each within `tolerance`. */
function presetWithin(
  percents: readonly number[],
  tolerance: number,
): ColumnLayout | undefined {
  return LAYOUT_MATCH_ORDER.find((layout) => {
    const target = COLUMN_LAYOUT_PERCENTS[layout];
    return (
      target.length === percents.length &&
      target.every(
        (share, index) => Math.abs(share - percents[index]!) <= tolerance,
      )
    );
  });
}

const COLUMN_COUNT: Record<ColumnLayout, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "2-1": 2,
  "1-2": 2,
  "3-1": 2,
  "1-3": 2,
  "1-2-1": 3,
};

/**
 * Each column's px width in `container`: the preset's shares, a third for
 * `"3"`, `"1-2"` and `"2-1"`, or the `columnWidths` percentages when the
 * section has them.
 */
function columnPixels(
  layout: ColumnLayout,
  container: number,
  columnWidths: readonly number[] | undefined,
): number[] {
  if (columnWidths) {
    return columnWidths.map((percent) => (container * percent) / 100);
  }
  switch (layout) {
    case "2":
      return [container / 2, container / 2];
    case "3":
      return [container / 3, container / 3, container / 3];
    case "1-2":
      return [container / 3, (container * 2) / 3];
    case "2-1":
      return [(container * 2) / 3, container / 3];
    case "1-3":
      return [container / 4, (container * 3) / 4];
    case "3-1":
      return [(container * 3) / 4, container / 4];
    case "1-2-1":
      return [container / 4, container / 2, container / 4];
    case "4":
      return [container / 4, container / 4, container / 4, container / 4];
    default:
      return [container];
  }
}

/**
 * Resolve `mj-column` widths, as percentages of the section's inner box, to
 * a layout. Topol renders through MJML, so MJML's rules apply.
 *
 * A width list within `WIDTH_TOLERANCE` of a preset keeps that preset. An
 * absent width is `mj-column`'s default, the parent width divided by the
 * column count, whatever its siblings state, so a row with no widths is
 * the even preset. One column is `"1"`: exact at 100%, approximated
 * otherwise. Two, three or four columns that fit no preset are scaled to
 * 100: scaled shares equal to a preset keep that preset, any others keep
 * the even preset of that count plus `columnWidths`. Either is exact when
 * the widths already total 100 within half a point; otherwise scaling
 * changed the source layout. A width that cannot be stored (not above 0)
 * keeps the even preset, approximated. Five or more columns fold onto
 * `"4"`, approximated.
 */
export function matchColumnLayout(percents: Array<number | null>): {
  layout: ColumnLayout;
  exact: boolean;
  columnWidths?: number[];
} {
  const count = percents.length;
  if (count === 0) return { layout: "1", exact: true };
  if (count > 4) return { layout: "4", exact: false };

  const resolved = percents.map((percent) => percent ?? 100 / count);
  const preset = presetWithin(resolved, WIDTH_TOLERANCE);
  if (preset) return { layout: preset, exact: true };
  if (count === 1) return { layout: "1", exact: false };

  const layout = evenLayout(count);
  if (columnWidthsIssue({ columns: layout, columnWidths: resolved }) !== null) {
    return { layout, exact: false };
  }
  // Half a point treats a float sum of shares that already are 100 as exact.
  const total = resolved.reduce((sum, share) => sum + share, 0);
  const exact = Math.abs(total - 100) <= 0.5;
  const scaled = sectionColumnPercents({
    columns: layout,
    columnWidths: resolved,
  });
  const scaledPreset = presetWithin(scaled, SCALED_TOLERANCE);
  if (scaledPreset) return { layout: scaledPreset, exact };
  return { layout, exact, columnWidths: scaled };
}

const PX_WIDTH = /^(\d+(?:\.\d+)?)\s*px$/i;

/**
 * A column's `width` as a percentage of `innerWidth`, or `null` when it
 * states none. A percentage is read as written. A px width is that many
 * pixels of the inner box, the email width less the section's side
 * padding, which is the box MJML sizes columns against.
 */
function columnPercent(
  value: string | undefined,
  innerWidth: number,
): number | null {
  const percent = parsePercent(value);
  if (percent !== null) return percent;
  const px = PX_WIDTH.exec((value ?? "").trim());
  if (!px || innerWidth <= 0) return null;
  return (Number(px[1]) / innerWidth) * 100;
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
    if (child.uid)
      ctx.uidMap?.set(child.uid, {
        node: child,
        block: converted?.block ?? null,
      });
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

  const padding = parsePadding(node);
  const innerWidth = ctx.style.settings.width - padding.left - padding.right;
  const rawWidths = columns.map((c) => attr(c, "width"));
  const percents = rawWidths.map((w) => columnPercent(w, innerWidth));
  const { layout, exact, columnWidths } = matchColumnLayout(percents);

  const slots = COLUMN_COUNT[layout];
  const pixels = columnPixels(layout, ctx.style.settings.width, columnWidths);
  const children: Block[][] = Array.from({ length: slots }, () => []);

  const background = readMjmlBackgroundImage(
    (name) => attr(node, name),
    "Section",
    ctx.style.settings.width,
  );
  const notes = [
    ...(exact
      ? []
      : [
          `Column widths ${rawWidths.map((w) => w ?? "auto").join(", ")} have no exact Templatical layout; resolved to "${layout}".${columns.length > 4 ? " Templatical supports up to four columns." : ""}`,
        ]),
    ...(background?.notes ?? []),
  ];
  entries.push({
    sourceTag: "mj-section",
    templaticalBlockType: "section",
    status: notes.length > 0 ? "approximated" : "converted",
    ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
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
  // `full-width="full-width"` makes this section's own background the
  // viewport band. The section stays transparent over it.
  const fullWidth =
    attr(node, "full-width") === "full-width" &&
    Boolean(backgroundColor || background);

  return [
    createSectionBlock({
      columns: layout,
      ...(columnWidths ? { columnWidths } : {}),
      children,
      styles: {
        padding,
        ...(!fullWidth && backgroundColor ? { backgroundColor } : {}),
      },
      ...(!fullWidth && background
        ? { backgroundImage: background.image }
        : {}),
      ...(fullWidth
        ? {
            wrapper: {
              ...(backgroundColor ? { backgroundColor } : {}),
              ...(background ? { backgroundImage: background.image } : {}),
              fullWidth: true,
            },
          }
        : {}),
    }),
  ];
}
