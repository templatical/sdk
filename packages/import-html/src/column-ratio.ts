import type { ColumnLayout } from "@templatical/types";

/**
 * The share of a section's width each column of a layout occupies.
 *
 * These are the percentages `@templatical/renderer` emits for the same layout
 * (`getWidthPercentages`), and they have to stay equal to them: this table is
 * what a declared ratio is snapped *to*, so a divergence would have the
 * importer choose `2-1` for a row the renderer then renders at some other
 * split — a silent disagreement with no failing surface between the two
 * packages. `@templatical/renderer` is a devDependency of this package and
 * must stay one (the importer has no runtime need of it), so the values are
 * copied rather than imported, and the agreement is asserted by the
 * renderer-agreement test in `column-ratio.test.ts`.
 *
 * The candidate list is this table's keys (`candidateLayouts` reads them).
 * Every `ColumnLayout` is a key. Key order is the tie-break: an equal
 * deviation keeps the earlier layout.
 *
 * Exported for that agreement test alone, which compares it against
 * `getWidthPercentages` value by value. Going through `resolveColumnRatio`
 * instead cannot do the job: a drift smaller than the snap tolerance still
 * snaps to the same layout, so a 50/50 target quietly moved to 55/45 passes
 * every behavioural case.
 */
export const LAYOUT_SHARES: Record<ColumnLayout, readonly number[]> = {
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

/**
 * How far, in percentage points on the worst column, a declared ratio may sit
 * from a layout and still be read as that layout.
 *
 * Measured against the corpus rather than chosen for roundness. The widest
 * real match is mailchimp's `width="350"` / `width="190"` sidebar row at
 * 64.8 / 35.2, **1.9pp** from `2-1`. A 90 / 10 split is **15pp** from `3-1`
 * and stays the counted equal columns.
 *
 * The closest layouts are 8.33pp apart (`2-1` at 66.67 and `3-1` at 75,
 * `1-2` at 33.33 and `1-3` at 25). Six is wider than half that gap, so two
 * windows can cover one ratio; the smaller worst-column deviation wins, and
 * an equal deviation keeps the earlier key.
 */
const SNAP_TOLERANCE_PP = 6;

/** A width a column declared, with the unit it declared it in. */
export interface ColumnWidth {
  unit: "px" | "%";
  value: number;
}

/** The layout a row is imported with, and what the choice lost. */
export interface ColumnRatio {
  layout: ColumnLayout;
  note?: string;
}

/**
 * `mj-column-per-66-67` → 66.67%, `mj-column-per-50` → 50%. Compiled MJML
 * carries a column's share in its class name and nowhere else — every column
 * div also gets `style="width:100%"` — so this signal has to outrank the
 * inline style or every MJML layout reads as an equal split.
 */
const MJ_COLUMN_PERCENT = /(?:^|\s)mj-column-per-(\d+)(?:-(\d+))?(?=\s|$)/;

/** `mj-column-px-350` → 350px, MJML's fixed-width column variant. */
const MJ_COLUMN_PIXELS = /(?:^|\s)mj-column-px-(\d+)(?=\s|$)/;

function parseColumnClass(className: string | undefined): ColumnWidth | null {
  if (!className) return null;

  const percent = className.match(MJ_COLUMN_PERCENT);
  if (percent) {
    const fraction = percent[2] ? `.${percent[2]}` : "";
    return usableWidth({
      unit: "%",
      value: parseFloat(`${percent[1]}${fraction}`),
    });
  }

  const pixels = className.match(MJ_COLUMN_PIXELS);
  if (pixels) return usableWidth({ unit: "px", value: parseFloat(pixels[1]) });

  return null;
}

/**
 * A length that states a share of its row, or `null`.
 *
 * A bare number is px, which is what a legacy `width="350"` attribute means.
 * Anything else — `auto`, a calc, an em length — states no share.
 */
function parseWidth(raw: string | undefined): ColumnWidth | null {
  if (raw === undefined) return null;
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(px|%)?$/);
  if (!match) return null;
  return usableWidth({
    unit: match[2] === "%" ? "%" : "px",
    value: parseFloat(match[1]),
  });
}

/**
 * Drops a width that cannot express a share of its row.
 *
 * `100%` is the trap this exists for: every compiled-MJML column div and every
 * Cerberus stack column carries `width:100%` beside its real cap, and a cell
 * claiming the whole row while sharing it with another cell is stating "fill
 * what is left" rather than a ratio. Normalising it reads two such columns as
 * an equal split, and one such column beside a 200px one as 33/67 — a ratio
 * the source never declared. A `100px` width is a real one, so the rule is on
 * the percentage unit alone.
 */
function usableWidth(width: ColumnWidth): ColumnWidth | null {
  if (!(width.value > 0)) return null;
  if (width.unit === "%" && width.value >= 100) return null;
  return width;
}

/**
 * The width a column host declares, read from the strongest signal it carries.
 *
 * Priority is by how specifically each signal states a *column's* share: an
 * `mj-column-*` class names it outright; `max-width` is the cap that decides
 * an inline-block column's rendered width and so wins over the `width:100%`
 * sitting beside it; a `width` style and the legacy `width` attribute come
 * last, style before attribute because CSS beats a presentational attribute in
 * every browser.
 *
 * Takes primitives rather than a Cheerio node so the whole ratio decision is
 * testable without a DOM.
 */
export function readColumnWidth(
  className: string | undefined,
  styles: Record<string, string>,
  widthAttr: string | undefined,
): ColumnWidth | null {
  return (
    parseColumnClass(className) ??
    parseWidth(styles["max-width"]) ??
    parseWidth(styles.width) ??
    parseWidth(widthAttr)
  );
}

/**
 * The declared widths as percentages of their row, or `null` when the row
 * declares no ratio at all.
 *
 * Every column must carry a width, in one unit: a single share of an unknown
 * total states no ratio, and neither does a px width beside a percentage. Both
 * are refused rather than guessed, because the fallback — the layout the
 * column count already gives — is correct, and a guess is not.
 */
function normalizeShares(widths: (ColumnWidth | null)[]): number[] | null {
  if (widths.length === 0) return null;
  const first = widths[0];
  if (!first) return null;
  if (widths.some((width) => !width || width.unit !== first.unit)) return null;

  const values = widths.map((width) => (width as ColumnWidth).value);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  return values.map((value) => (value / total) * 100);
}

/** The layouts that hold exactly this many columns. */
function candidateLayouts(count: number): ColumnLayout[] {
  return (Object.keys(LAYOUT_SHARES) as ColumnLayout[]).filter(
    (layout) => LAYOUT_SHARES[layout].length === count,
  );
}

/** How far the worst column of `shares` sits from `layout`, in points. */
function deviation(shares: number[], layout: ColumnLayout): number {
  const target = LAYOUT_SHARES[layout];
  return Math.max(...shares.map((share, i) => Math.abs(share - target[i])));
}

/** The layout `shares` states, or `null` when none is within tolerance. */
function snapToLayout(shares: number[]): ColumnLayout | null {
  let best: ColumnLayout | null = null;
  let bestDeviation = Number.POSITIVE_INFINITY;
  for (const layout of candidateLayouts(shares.length)) {
    const distance = deviation(shares, layout);
    if (distance < bestDeviation) {
      best = layout;
      bestDeviation = distance;
    }
  }
  return best !== null && bestDeviation <= SNAP_TOLERANCE_PP ? best : null;
}

function formatShare(share: number): string {
  return `${Math.round(share * 10) / 10}%`;
}

/**
 * What snapping could not express, named as the reader sees it.
 *
 * "equal columns" is true because the layouts a count alone produces — `2`,
 * `3` and `4` — are equal splits; `resolveColumnRatio` is the only caller and
 * never reaches here for any other. Naming the layout's own percentages
 * instead would leak the renderer's 33.34 rounding column into a report.
 */
function describeRatioLoss(shares: number[]): string {
  return (
    `Column widths ${shares.map(formatShare).join(" / ")} have no ` +
    `Templatical equivalent. The section was imported as ${shares.length} ` +
    "equal columns."
  );
}

/**
 * The layout a row's declared widths choose, given the layout its column count
 * already produced.
 *
 * Widths decide the *ratio* and never the count: `counted` fixes how many
 * columns there are, and the only layouts considered are the ones holding
 * exactly that many. A row declaring nothing, declaring only some of its
 * columns, or mixing units keeps `counted` and reports nothing — there is no
 * observed ratio to have lost. A ratio outside tolerance keeps `counted` too,
 * and names itself in a note, which is the only outcome that is a downgrade.
 *
 * Call it only for a `counted` that has columns to choose between. A merged
 * row (`"1"`) has none, and describing the ratio of columns the section no
 * longer has would contradict the merge note that row already carries.
 */
export function resolveColumnRatio(
  widths: (ColumnWidth | null)[],
  counted: ColumnLayout,
): ColumnRatio {
  const shares = normalizeShares(widths);
  if (!shares) return { layout: counted };

  const snapped = snapToLayout(shares);
  if (snapped) return { layout: snapped };

  return { layout: counted, note: describeRatioLoss(shares) };
}
