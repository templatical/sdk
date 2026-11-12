import { COLUMN_LAYOUT_PERCENTS, type ColumnLayout } from "@templatical/types";

/**
 * Get width percentages for each column in a layout.
 */
export function getWidthPercentages(layout: ColumnLayout): string[] {
  const percents = COLUMN_LAYOUT_PERCENTS[layout] ?? [100];
  return percents.map((percent) => `${percent}%`);
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
      const percents = COLUMN_LAYOUT_PERCENTS[layout] ?? [100];
      return percents.map((percent) => (containerWidth * percent) / 100);
    }
  }
}
