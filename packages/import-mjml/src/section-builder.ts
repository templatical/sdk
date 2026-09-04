import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import { createSectionBlock } from "@templatical/types";
import type {
  Block,
  ColumnLayout,
  SectionWrapper,
  SpacingValue,
} from "@templatical/types";
import {
  parseColor,
  parsePaddingShorthand,
  parsePercent,
  parsePxValue,
} from "./attribute-parser";
import {
  childElements,
  resolveAttributes,
  tagOf,
  type Attrs,
} from "./attribute-resolver";
import { convertElement } from "./block-mapper";
import {
  baseFields,
  convertHtmlFallback,
  type ConvertContext,
} from "./block-base";
import type { ImportReportEntry } from "./types";

/** Reverse of `packages/renderer/src/columns.ts`, keyed by column count. */
const LAYOUT_SHAPES: Array<{ layout: ColumnLayout; percents: number[] }> = [
  { layout: "1", percents: [100] },
  { layout: "2", percents: [50, 50] },
  { layout: "1-2", percents: [33.33, 66.67] },
  { layout: "2-1", percents: [66.67, 33.33] },
  { layout: "3", percents: [33.33, 33.33, 33.34] },
];

/** Percentage points of drift tolerated per column before a match is inexact. */
const WIDTH_TOLERANCE = 2;

/**
 * Resolve MJML column widths to one of the five layouts `ColumnLayout` allows.
 *
 * `exact: false` means the caller must report `approximated` — MJML permits any
 * number of columns at any width and this union permits five shapes, so this is
 * the importer's main irreducible loss (§8.1).
 */
export function matchColumnLayout(percents: Array<number | null>): {
  layout: ColumnLayout;
  exact: boolean;
} {
  const count = percents.length;
  if (count === 0) return { layout: "1", exact: true };

  // No widths at all is MJML's "distribute equally", which is exactly what the
  // n-column layout means — not a missing value to approximate around.
  if (percents.every((p) => p === null)) {
    if (count === 1) return { layout: "1", exact: true };
    if (count === 2) return { layout: "2", exact: true };
    if (count === 3) return { layout: "3", exact: true };
    return { layout: "3", exact: false };
  }

  const resolved = percents.map((p) => p ?? 100 / count);

  const sameCount = LAYOUT_SHAPES.filter(
    (shape) => shape.percents.length === count,
  );

  for (const shape of sameCount) {
    const fits = shape.percents.every(
      (want, i) => Math.abs(want - resolved[i]) <= WIDTH_TOLERANCE,
    );
    if (fits) return { layout: shape.layout, exact: true };
  }

  // Nearest same-count shape by total absolute error; if the count itself has
  // no shape (4+), collapse to "3" and let the caller fold the overflow.
  const candidates =
    sameCount.length > 0
      ? sameCount
      : LAYOUT_SHAPES.filter((shape) => shape.layout === "3");

  let best = candidates[0];
  let bestError = Infinity;
  for (const shape of candidates) {
    const error = shape.percents.reduce(
      (sum, want, i) => sum + Math.abs(want - (resolved[i] ?? 0)),
      0,
    );
    if (error < bestError) {
      bestError = error;
      best = shape;
    }
  }

  return { layout: best.layout, exact: false };
}

const COLUMN_COUNT: Record<ColumnLayout, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "2-1": 2,
  "1-2": 2,
};

/** Column pixel widths per layout, mirroring `renderer/src/columns.ts`. */
function columnPixels(layout: ColumnLayout, containerWidth: number): number[] {
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

/** The `mj-column` elements of a section, reaching through an `mj-group`. */
function readColumns(
  $el: Cheerio<Element>,
  ctx: ConvertContext,
): { columns: Cheerio<Element>[]; grouped: boolean } {
  const kids = childElements($el, ctx.$);
  const group = kids.find(($k) => tagOf($k[0]) === "mj-group");

  if (group) {
    return {
      columns: childElements(group, ctx.$).filter(
        ($k) => tagOf($k[0]) === "mj-column",
      ),
      grouped: true,
    };
  }

  return {
    columns: kids.filter(($k) => tagOf($k[0]) === "mj-column"),
    grouped: false,
  };
}

function convertColumnChildren(
  $column: Cheerio<Element>,
  ctx: ConvertContext,
  entries: ImportReportEntry[],
): Block[] {
  const blocks: Block[] = [];

  for (const $child of childElements($column, ctx.$)) {
    const tag = tagOf($child[0]);

    // MJML forbids mj-section inside mj-column, and `addBlock` in
    // @templatical/core refuses a section into a column too, so producing one
    // here would be dropped downstream without a trace.
    if (tag === "mj-section" || tag === "mj-wrapper") {
      const attrs = resolveAttributes($child, ctx.cascade);
      blocks.push(convertHtmlFallback($child, ctx, attrs));
      entries.push({
        sourceTag: tag,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: "MJML forbids <mj-section> inside <mj-column>; the nested section's markup is preserved as an html block.",
      });
      continue;
    }

    const converted = convertElement($child, ctx);
    if (!converted) continue;
    entries.push(converted.entry);
    if (converted.block) blocks.push(converted.block);
  }

  return blocks;
}

/**
 * Build a `SectionBlock` (always exactly one) from an `mj-section`.
 *
 * Returns an array so the caller can treat sections and wrappers uniformly.
 */
export function buildSection(
  $el: Cheerio<Element>,
  ctx: ConvertContext,
  entries: ImportReportEntry[],
  wrapper?: SectionWrapper,
): Block[] {
  const attrs = resolveAttributes($el, ctx.cascade);
  const { columns, grouped } = readColumns($el, ctx);

  const percents = columns.map(($c) =>
    parsePercent(resolveAttributes($c, ctx.cascade).width),
  );
  const { layout, exact } = matchColumnLayout(percents);
  const slots = COLUMN_COUNT[layout];
  const pixels = columnPixels(layout, ctx.containerWidth);

  // `entries` is the document-wide report the whole walk shares, not a
  // per-section array, so the section's own entry is pushed here — before its
  // children convert — to land ahead of them and ahead of whatever a sibling
  // section pushes next. Splicing it in afterward (e.g. `unshift`) would put
  // every section's entry at the front of the entire report instead of at the
  // front of its own children, reversing section order in a multi-section
  // document and interleaving children under the wrong parent.
  const shown = percents.map((p) => (p === null ? "auto" : `${p}%`)).join(", ");
  entries.push({
    sourceTag: "mj-section",
    templaticalBlockType: "section",
    status: exact ? "converted" : "approximated",
    ...(exact
      ? {}
      : {
          note: `Column widths ${shown} have no exact Templatical layout; resolved to "${layout}".`,
        }),
  });

  const children: Block[][] = Array.from({ length: slots }, () => []);

  columns.forEach(($column, index) => {
    // A 4th+ column folds into the last slot rather than becoming an html
    // block: its content converts perfectly and only the geometry is lost.
    const slot = Math.min(index, slots - 1);
    const columnCtx: ConvertContext = {
      ...ctx,
      containerWidth: Math.round(pixels[slot] ?? ctx.containerWidth),
    };
    children[slot].push(...convertColumnChildren($column, columnCtx, entries));
  });

  const borderRadius = parsePxValue(attrs["border-radius"]);

  const section = createSectionBlock({
    columns: layout,
    children,
    ...(grouped ? { stackOnMobile: false } : {}),
    ...(borderRadius > 0 ? { borderRadius } : {}),
    ...(wrapper ? { wrapper } : {}),
    ...baseFields(attrs),
  });

  return [section];
}

function readWrapper(attrs: Attrs): SectionWrapper {
  const backgroundColor = parseColor(attrs["background-color"]);
  const padding: SpacingValue = parsePaddingShorthand(attrs.padding);
  const borderRadius = parsePxValue(attrs["border-radius"]);

  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    padding,
    ...(borderRadius > 0 ? { borderRadius } : {}),
  };
}

/**
 * Fold an `mj-wrapper` into the `wrapper` field of the section(s) it holds.
 *
 * A wrapper is not a block: `SectionWrapper` is exactly the band the renderer
 * emits an `mj-wrapper` for (`renderer/src/index.ts:223`), so representing it
 * as its own section would double the nesting on every round trip.
 */
export function buildWrapper(
  $el: Cheerio<Element>,
  ctx: ConvertContext,
  entries: ImportReportEntry[],
): Block[] {
  const attrs = resolveAttributes($el, ctx.cascade);
  const wrapper = readWrapper(attrs);

  const sections = childElements($el, ctx.$).filter(
    ($k) => tagOf($k[0]) === "mj-section",
  );

  if (sections.length === 0) {
    entries.push({
      sourceTag: "mj-wrapper",
      templaticalBlockType: null,
      status: "skipped",
      note: "An <mj-wrapper> with no <mj-section> children produces nothing.",
    });
    return [];
  }

  if (sections.length > 1) {
    entries.push({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "section",
      status: "approximated",
      note: `An <mj-wrapper> holding ${sections.length} sections was applied to each of them — Templatical has no multi-section band.`,
    });
  }

  return sections.flatMap(($section) =>
    buildSection($section, ctx, entries, wrapper),
  );
}
