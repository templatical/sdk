import {
  COLUMN_LAYOUT_PERCENTS,
  columnWidthsIssue,
  sectionColumnPercents,
} from "@templatical/types";
import type { ColumnLayout } from "@templatical/types";

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

export const COLUMN_COUNT: Record<ColumnLayout, number> = {
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
export function columnPixels(
  layout: ColumnLayout,
  container: number,
  columnWidths?: readonly number[],
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
 * Resolve `standard-column` widths, as percentages of the section's inner
 * box, to a layout. Easy Email Pro renders through MJML, so MJML's rules
 * apply.
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

/** Convert absolute px column widths to percents of `bodyWidth`. */
export function widthsToPercents(
  widthsPx: Array<number | undefined>,
  bodyWidth: number,
): Array<number | null> {
  return widthsPx.map((w) => (w === undefined ? null : (w / bodyWidth) * 100));
}
