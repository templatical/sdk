import { COLUMN_LAYOUT_PERCENTS, type ColumnLayout } from "@templatical/types";

/** A preset row, or `[100]` when `layout` is not one of the keys. */
function layoutPercents(layout: string): readonly number[] {
  if (Object.hasOwn(COLUMN_LAYOUT_PERCENTS, layout)) {
    return COLUMN_LAYOUT_PERCENTS[layout as ColumnLayout];
  }
  return [100];
}

/**
 * Get width percentages for each column in a layout.
 */
export function getWidthPercentages(layout: ColumnLayout): string[] {
  return layoutPercents(layout).map((percent) => `${percent}%`);
}

/**
 * Get width in pixels for each column in a layout.
 *
 * `"3"`, `"1-2"` and `"2-1"` divide by 3. `33.33%` of the container is a
 * different number, and a full-width image in those columns uses this width.
 */
export function getWidthPixels(
  layout: ColumnLayout,
  containerWidth: number,
): number[] {
  switch (layout) {
    case "3":
      return [containerWidth / 3, containerWidth / 3, containerWidth / 3];
    case "1-2":
      return [containerWidth / 3, (containerWidth * 2) / 3];
    case "2-1":
      return [(containerWidth * 2) / 3, containerWidth / 3];
    default: {
      return layoutPercents(layout).map(
        (percent) => (containerWidth * percent) / 100,
      );
    }
  }
}
