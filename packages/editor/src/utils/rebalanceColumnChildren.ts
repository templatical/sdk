import type { Block, ColumnLayout } from "@templatical/types";

function expectedColumnCount(layout: ColumnLayout): number {
  if (layout === "1") return 1;
  if (layout === "3") return 3;
  return 2;
}

/**
 * Resize a section's `children` array to match a new column layout, without
 * dropping any blocks. Growing pads with empty columns; shrinking merges
 * any excess columns' blocks into the last kept column so the user never
 * silently loses content.
 */
export function rebalanceColumnChildren(
  current: Block[][],
  layout: ColumnLayout,
): Block[][] {
  const target = expectedColumnCount(layout);

  if (current.length === target) {
    return current;
  }

  if (current.length < target) {
    const padding = Array.from(
      { length: target - current.length },
      () => [] as Block[],
    );
    return [...current, ...padding];
  }

  const kept = current.slice(0, target);
  const overflow = current.slice(target).flat();
  const merged = [...kept[target - 1], ...overflow];
  return [...kept.slice(0, target - 1), merged];
}
