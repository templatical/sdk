import {
  COLUMN_LAYOUT_PERCENTS,
  sectionColumnPercents,
} from "@templatical/types";
import type { ColumnLayout } from "@templatical/types";
import { parsePxValue, parseStyleAttribute } from "./css";

/** Widths within 1px count as the same column width. */
const COLUMN_WIDTH_TOLERANCE = 1;
const EQUAL_COLUMN_WORD = { "2": "two", "3": "three", "4": "four" } as const;

/**
 * Positive px from an inline `width`, else from the `width` attribute.
 * A non-px length is unread.
 */
export function statedPx(
  widthAttr: string | undefined,
  styleAttr: string | undefined,
): number | undefined {
  const inline = parsePxValue(parseStyleAttribute(styleAttr).width);
  if (inline > 0) return inline;
  const attribute = parsePxValue(widthAttr);
  return attribute > 0 ? attribute : undefined;
}

/**
 * A note when at least two readable widths differ by more than 1px.
 * An unread width stays in its place as "an unstated width".
 */
export function unequalWidthNote(
  widths: Array<number | undefined>,
  layout: "2" | "3" | "4",
): string | undefined {
  const readable: number[] = [];
  for (const width of widths) {
    if (width !== undefined) readable.push(width);
  }
  if (readable.length < 2) return undefined;
  const spread = Math.max(...readable) - Math.min(...readable);
  if (spread <= COLUMN_WIDTH_TOLERANCE) return undefined;
  const parts = widths.map((width) =>
    width === undefined ? "an unstated width" : `${width}px`,
  );
  const listed = `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Columns of ${listed} became ${EQUAL_COLUMN_WORD[layout]} equal columns.`;
}

/** The unequal presets a row of stated widths can match, in the order tried. */
const UNEQUAL_PRESETS: readonly ColumnLayout[] = [
  "2-1",
  "1-2",
  "3-1",
  "1-3",
  "1-2-1",
];

/** A row's layout, its custom shares, and what it could not carry. */
export interface StatedColumns {
  layout: ColumnLayout;
  columnWidths?: number[];
  note?: string;
}

/**
 * The layout of a row of two to four columns, from their stated px widths.
 *
 * Stripo draws each column at its px width with a gutter between them, so a
 * column's share is its width over the sum of the row's widths. Widths
 * within 1px of each other are `even`. Widths within 1px of an unequal
 * preset's shares (`2-1`, `1-2`, `3-1`, `1-3`, `1-2-1`) are that preset. Any
 * other widths keep `even` with their shares as `columnWidths`. A width that
 * cannot be read leaves no ratio: the row is `even`, noted when its readable
 * widths differ (`unequalWidthNote`).
 */
export function statedLayout(
  widths: Array<number | undefined>,
  even: "2" | "3" | "4",
): StatedColumns {
  const stated = widths.filter((width): width is number => width !== undefined);
  if (stated.length < widths.length) {
    const note = unequalWidthNote(widths, even);
    return note ? { layout: even, note } : { layout: even };
  }
  if (Math.max(...stated) - Math.min(...stated) <= COLUMN_WIDTH_TOLERANCE) {
    return { layout: even };
  }
  const total = stated.reduce((sum, width) => sum + width, 0);
  const preset = UNEQUAL_PRESETS.find((layout) => {
    const shares = COLUMN_LAYOUT_PERCENTS[layout];
    return (
      shares.length === stated.length &&
      shares.every(
        (share, index) =>
          Math.abs((total * share) / 100 - stated[index]!) <=
          COLUMN_WIDTH_TOLERANCE,
      )
    );
  });
  if (preset) return { layout: preset };
  return {
    layout: even,
    columnWidths: sectionColumnPercents({
      columns: even,
      columnWidths: stated,
    }),
  };
}
