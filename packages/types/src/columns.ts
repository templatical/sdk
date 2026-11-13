import type { ColumnLayout, SectionBlock } from "./blocks";
import { getColumnCount } from "./operations";

/**
 * Each preset's column shares, the percentages the renderer writes on
 * `mj-column`. `"3"` gives the last column the rounding remainder so the
 * row totals 100. Preset rows are these literals; they are not recomputed.
 */
export const COLUMN_LAYOUT_PERCENTS: Readonly<
  Record<ColumnLayout, readonly number[]>
> = {
  "1": [100],
  "2": [50, 50],
  "3": [33.33, 33.33, 33.34],
  "4": [25, 25, 25, 25],
  "1-2": [33.33, 66.67],
  "2-1": [66.67, 33.33],
  "1-3": [25, 75],
  "3-1": [75, 25],
  "1-2-1": [25, 50, 25],
};

type ColumnWidthsSection = Pick<SectionBlock, "columns" | "columnWidths">;

/** A preset row, or `[100]` when `layout` is not one of the keys. */
function layoutPercents(layout: string): readonly number[] {
  if (Object.hasOwn(COLUMN_LAYOUT_PERCENTS, layout)) {
    return COLUMN_LAYOUT_PERCENTS[layout as ColumnLayout];
  }
  return [100];
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Why `columnWidths` cannot override the preset, or `null` when it is absent
 * or usable. Count is checked first: a short or long list is `"count"` even
 * when a value is also unusable. Every index is read, so a hole is `"value"`.
 */
export function columnWidthsIssue(
  section: ColumnWidthsSection,
): "count" | "value" | null {
  const widths = section.columnWidths;
  if (widths === undefined) return null;
  if (!Array.isArray(widths)) return "value";
  if (widths.length !== getColumnCount(section.columns)) return "count";
  for (let index = 0; index < widths.length; index++) {
    if (!isPositiveFinite(widths[index])) return "value";
  }
  return null;
}

/** Integer units after dividing by the largest share. 1e12 stays inside a safe integer. */
const SHARE_SCALE = 1e12;
const HUNDREDTHS = 10000;

/**
 * Scale `values` to percentages that total 100, each at least 0.01.
 *
 * Shares are divided by the largest share before they are added, so
 * `1e308 + 1e308` does not become `Infinity`. The quotas are then 10000
 * hundredths, in integers: floor each share, give every column at least one
 * hundredth, and hand each leftover hundredth to the largest remainder.
 * An equal remainder goes to the earlier column.
 */
function scaleToHundred(values: readonly number[]): number[] {
  const count = values.length;
  let max = 0;
  for (let index = 0; index < count; index++) {
    const value = values[index]!;
    if (value > max) max = value;
  }

  const units: bigint[] = [];
  let total = 0n;
  for (let index = 0; index < count; index++) {
    const unit = BigInt(Math.round((values[index]! / max) * SHARE_SCALE));
    units.push(unit);
    total += unit;
  }

  const floors: number[] = [];
  const remainders: bigint[] = [];
  const target = BigInt(HUNDREDTHS);
  for (let index = 0; index < count; index++) {
    const product = units[index]! * target;
    floors.push(Number(product / total));
    remainders.push(product % total);
  }

  for (let index = 0; index < count; index++) {
    if (floors[index]! < 1) floors[index] = 1;
  }

  let used = 0;
  for (let index = 0; index < count; index++) used += floors[index]!;
  const remaining = HUNDREDTHS - used;
  const order = Array.from({ length: count }, (_, index) => index);

  if (remaining > 0) {
    order.sort((left, right) => {
      if (remainders[left] === remainders[right]) return left - right;
      return remainders[left]! > remainders[right]! ? -1 : 1;
    });
    for (let index = 0; index < remaining; index++) {
      floors[order[index]!]! += 1;
    }
  } else if (remaining < 0) {
    // A column bumped up to 0.01 can push the row past 100. Take the debt
    // from the smallest remainder that can spare it; a tie loses the later column.
    order.sort((left, right) => {
      if (remainders[left] === remainders[right]) return right - left;
      return remainders[left]! < remainders[right]! ? -1 : 1;
    });
    let debt = -remaining;
    for (const index of order) {
      if (debt === 0) break;
      const spare = floors[index]! - 1;
      if (spare <= 0) continue;
      const take = Math.min(spare, debt);
      floors[index] = floors[index]! - take;
      debt -= take;
    }
  }

  return floors.map((hundredths) => hundredths / 100);
}

/**
 * The percentages a section renders. A usable `columnWidths` is scaled to
 * 100. Anything else is the preset's row, or `[100]` when `columns` is not
 * a known layout.
 */
export function sectionColumnPercents(section: ColumnWidthsSection): number[] {
  if (
    section.columnWidths !== undefined &&
    columnWidthsIssue(section) === null
  ) {
    return scaleToHundred(section.columnWidths);
  }
  return [...layoutPercents(section.columns)];
}
