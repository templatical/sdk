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

/** The px width Chamaileon gives a column whose `width` is unset. */
const DEFAULT_COLUMN_WIDTH = 300;

function evenLayout(count: number): ColumnLayout {
  if (count === 3) return "3";
  if (count === 4) return "4";
  return "2";
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
 * Resolve a multicolumn's px `width`s to a layout.
 *
 * Chamaileon sizes columns in px, with the fullwidth's content padding and
 * the multicolumn's spacers around and between them, so a column's share is
 * its width over the sum of the row's widths. A width that is unset or not
 * a px length counts as Chamaileon's default, 300px. Shares within
 * `WIDTH_TOLERANCE` of a preset keep that preset; any others keep the even
 * preset of that count plus `columnWidths`. Both are exact. A width that is
 * not above 0 keeps the even preset, approximated. Five or more columns
 * fold onto `"4"`, approximated.
 */
export function matchColumnLayout(widthsPx: Array<number | undefined>): {
  layout: ColumnLayout;
  exact: boolean;
  columnWidths?: number[];
} {
  const count = widthsPx.length;
  if (count <= 1) return { layout: "1", exact: true };
  if (count > 4) return { layout: "4", exact: false };

  const widths = widthsPx.map((width) => width ?? DEFAULT_COLUMN_WIDTH);
  const layout = evenLayout(count);
  if (columnWidthsIssue({ columns: layout, columnWidths: widths }) !== null) {
    return { layout, exact: false };
  }
  const shares = sectionColumnPercents({
    columns: layout,
    columnWidths: widths,
  });
  const preset = LAYOUT_MATCH_ORDER.find((candidate) => {
    const target = COLUMN_LAYOUT_PERCENTS[candidate];
    return (
      target.length === count &&
      target.every(
        (share, index) => Math.abs(share - shares[index]!) <= WIDTH_TOLERANCE,
      )
    );
  });
  if (preset) return { layout: preset, exact: true };
  return { layout, exact: true, columnWidths: shares };
}
