import type { ColumnLayout } from "@templatical/types";

/**
 * Get width percentages for each column in a layout.
 */
export function getWidthPercentages(layout: ColumnLayout): string[] {
  switch (layout) {
    case "2":
      return ["50%", "50%"];
    case "3":
      return ["33.33%", "33.33%", "33.33%"];
    case "1-2":
      return ["33.33%", "66.67%"];
    case "2-1":
      return ["66.67%", "33.33%"];
    default:
      return ["100%"];
  }
}

/**
 * Get width in pixels for each column in a layout.
 */
export function getWidthPixels(
  layout: ColumnLayout,
  containerWidth: number,
): number[] {
  switch (layout) {
    case "2":
      return [containerWidth * 0.5, containerWidth * 0.5];
    case "3":
      return [containerWidth / 3, containerWidth / 3, containerWidth / 3];
    case "1-2":
      return [containerWidth / 3, (containerWidth * 2) / 3];
    case "2-1":
      return [(containerWidth * 2) / 3, containerWidth / 3];
    default:
      return [containerWidth];
  }
}
