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
