import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  createSectionBlock,
  heroBoxWidth,
  resolveHero,
} from "@templatical/types";
import type {
  Block,
  ColumnLayout,
  SectionWrapper,
  SpacingValue,
} from "@templatical/types";
import {
  parseColor,
  parseDefinitePx,
  parsePaddingShorthand,
  parsePercent,
  readMjmlBackgroundImage,
  readMjmlHero,
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
  readBorder,
  readBorderRadius,
  type ConvertContext,
} from "./block-base";
import { planSiblings } from "./display-condition";
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

  // A partial mix of known and absent widths fills each absent column with
  // its share of what the known widths leave over, not an equal split of the
  // whole row — an equal split is only correct when every column is absent,
  // which the branch above already handles. Clamped at 0 so a document whose
  // explicit widths already exceed 100% cannot produce a negative fill.
  const nullCount = percents.filter((p) => p === null).length;
  const knownSum = percents.reduce((sum: number, p) => sum + (p ?? 0), 0);
  const remainder = nullCount > 0 ? Math.max(0, 100 - knownSum) / nullCount : 0;
  const resolved = percents.map((p) => p ?? remainder);

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

/**
 * The `mj-column` elements of a section, in document order: a direct
 * `mj-column` child contributes itself, and an `mj-group` child contributes
 * every `mj-column` it holds at the group's own position — so a section
 * mixing direct columns with one or more groups keeps every column instead
 * of losing all but the first group's. `grouped` is true whenever any
 * `mj-group` child is present, which is what drives `stackOnMobile: false`.
 */
function readColumns(
  $el: Cheerio<Element>,
  ctx: ConvertContext,
): { columns: Cheerio<Element>[]; grouped: boolean } {
  const kids = childElements($el, ctx.$);
  const columns: Cheerio<Element>[] = [];
  let grouped = false;

  for (const $kid of kids) {
    const tag = tagOf($kid[0]);
    if (tag === "mj-column") {
      columns.push($kid);
    } else if (tag === "mj-group") {
      grouped = true;
      columns.push(
        ...childElements($kid, ctx.$).filter(
          ($k) => tagOf($k[0]) === "mj-column",
        ),
      );
    }
  }

  return { columns, grouped };
}

/**
 * A column's children, in document order, one block per unit `planSiblings`
 * groups them into.
 *
 * Routed through `planSiblings` for the same reason `walkBody` is
 * (`converter.ts`): the renderer wraps a conditional block in bracketing
 * `mj-raw` guards inside a column exactly as it does at top level
 * (`renderers/section.ts` calls the same `wrapWithDisplayCondition` helper as
 * `index.ts`), so recovering the condition here needs the identical fold.
 */
function convertColumnChildren(
  $column: Cheerio<Element>,
  ctx: ConvertContext,
  entries: ImportReportEntry[],
): Block[] {
  const blocks: Block[] = [];

  for (const unit of planSiblings(childElements($column, ctx.$))) {
    const tag = tagOf(unit.$el[0]);

    // MJML forbids mj-section, mj-wrapper and mj-hero inside mj-column, and
    // `addBlock` in @templatical/core refuses a section into a column too, so
    // producing one here would be dropped downstream without a trace.
    if (tag === "mj-section" || tag === "mj-wrapper" || tag === "mj-hero") {
      const attrs = resolveAttributes(unit.$el, ctx.cascade);
      const fallback = convertHtmlFallback(unit.$el, ctx, attrs);
      if (unit.displayCondition)
        fallback.displayCondition = unit.displayCondition;
      blocks.push(fallback);
      const noun =
        tag === "mj-section"
          ? "section"
          : tag === "mj-hero"
            ? "hero"
            : "wrapper";
      entries.push({
        sourceTag: tag,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: `MJML forbids <${tag}> inside <mj-column>; the nested ${noun}'s markup is preserved as an html block.`,
      });
      continue;
    }

    const converted = convertElement(unit.$el, ctx);
    if (!converted) continue;
    entries.push(converted.entry);
    if (!converted.block) continue;

    if (unit.displayCondition) {
      converted.block.displayCondition = unit.displayCondition;
    }

    blocks.push(converted.block);
  }

  return blocks;
}

/**
 * A column's width as a percentage of the section's container, or `null`
 * when the column carries no definite width of its own.
 *
 * `mj-column` accepts either a percentage or a px length, and a px width is
 * real geometry — converting it here lets it participate in
 * `matchColumnLayout` as a known value instead of falling through to "auto"
 * and losing the author's intended ratio.
 */
function columnWidthPercent(
  value: string | undefined,
  containerWidth: number,
): number | null {
  const percent = parsePercent(value);
  if (percent !== null) return percent;

  const px = parseDefinitePx(value);
  return px !== null && containerWidth > 0 ? (px / containerWidth) * 100 : null;
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

  const columnAttrs = columns.map(($c) => resolveAttributes($c, ctx.cascade));
  const rawWidths = columnAttrs.map((column) => column.width);
  const percents = rawWidths.map((width) =>
    columnWidthPercent(width, ctx.containerWidth),
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
  //
  // Built from the raw attribute strings, not the resolved `percents` — a px
  // width would otherwise show as a repeating-decimal percentage of the
  // container instead of the value the author actually wrote.
  const shown = rawWidths.map((w) => w || "auto").join(", ");
  const notes: string[] = exact
    ? []
    : [
        `Column widths ${shown} have no exact Templatical layout; resolved to "${layout}".`,
      ];
  const borderRadius = readBorderRadius(attrs, "Section", notes);
  const border = readBorder(attrs, "Section", notes);
  const background = readMjmlBackgroundImage(
    (name) => attrs[name],
    "Section",
    ctx.containerWidth,
  );
  if (background) notes.push(...background.notes);
  entries.push({
    sourceTag: "mj-section",
    templaticalBlockType: "section",
    status: notes.length > 0 ? "approximated" : "converted",
    ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
  });

  const children: Block[][] = Array.from({ length: slots }, () => []);

  columns.forEach(($column, index) => {
    // A 4th+ column folds into the last slot rather than becoming an html
    // block: its content converts perfectly and only the geometry is lost.
    const slot = Math.min(index, slots - 1);
    const { left, right } = parsePaddingShorthand(columnAttrs[index].padding);
    const columnCtx: ConvertContext = {
      ...ctx,
      containerWidth: Math.round(pixels[slot] ?? ctx.containerWidth),
      columnPadding: left + right,
    };
    children[slot].push(...convertColumnChildren($column, columnCtx, entries));
  });

  const section = createSectionBlock({
    columns: layout,
    children,
    ...(grouped ? { stackOnMobile: false } : {}),
    ...(borderRadius ? { borderRadius } : {}),
    ...(border ? { border } : {}),
    ...(background ? { backgroundImage: background.image } : {}),
    ...(wrapper ? { wrapper } : {}),
    // "native": mj-section is the one element whose own background-color
    // attribute is its container fill (renderers/section.ts:32) — every other
    // baseFields caller reads container-background-color instead.
    ...baseFields(attrs, "native"),
  });

  return [section];
}

/**
 * Build a one-column `SectionBlock` from an `mj-hero`, whose content elements
 * sit directly under it (no `mj-column`). Its mode, height and background map
 * onto `hero` and `backgroundImage` (`readMjmlHero`). mj-hero paints white
 * where its source sets no `background-color`, so an absent colour imports as
 * `#ffffff`; an explicit `transparent` stays unset.
 */
export function buildHero(
  $el: Cheerio<Element>,
  ctx: ConvertContext,
  entries: ImportReportEntry[],
  wrapper?: SectionWrapper,
): Block[] {
  const attrs = resolveAttributes($el, ctx.cascade);
  const notes: string[] = [];
  const read = readMjmlHero((name) => attrs[name], "Hero", ctx.containerWidth);
  notes.push(...read.notes);
  const borderRadius = readBorderRadius(attrs, "Hero", notes);

  // Pushed before the children convert, as in buildSection, so the hero's
  // entry lands ahead of its own content in the shared report.
  entries.push({
    sourceTag: "mj-hero",
    templaticalBlockType: "section",
    status: notes.length > 0 ? "approximated" : "converted",
    ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
  });

  // The renderer narrows an applied hero's box, and so its content's width, by
  // each enclosing band's padding (`sectionContext` in renderer/src/index.ts),
  // and an import measures it the same way. A hero the renderer draws as a
  // regular section is measured like one, at the full content width.
  const applied = resolveHero({
    columns: "1",
    hero: read.hero ?? undefined,
    backgroundImage: read.image ?? undefined,
  })?.applied;
  const containerWidth = applied
    ? heroBoxWidth(ctx.containerWidth, [wrapper?.padding])
    : ctx.containerWidth;

  const { left, right } = parsePaddingShorthand(attrs.padding);
  const children = convertColumnChildren(
    $el,
    { ...ctx, containerWidth, columnPadding: left + right },
    entries,
  );

  const fields = baseFields(attrs, "native");
  if (attrs["background-color"] === undefined) {
    fields.styles.backgroundColor = "#ffffff";
  }

  const section = createSectionBlock({
    columns: "1",
    children: [children],
    ...(borderRadius ? { borderRadius } : {}),
    ...(read.image ? { backgroundImage: read.image } : {}),
    ...(read.hero ? { hero: read.hero } : {}),
    ...(wrapper ? { wrapper } : {}),
    ...fields,
  });

  return [section];
}

const WRAPPER_BORDER_ATTRIBUTES = [
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
];

/**
 * `SectionWrapper` has no border, so each `border` or `border-<side>` the
 * wrapper sets pushes a note instead.
 */
function readWrapper(
  attrs: Attrs,
  notes: string[],
  boxWidth: number,
): SectionWrapper {
  const backgroundColor = parseColor(attrs["background-color"]);
  const padding: SpacingValue = parsePaddingShorthand(attrs.padding);
  const borderRadius = readBorderRadius(attrs, "Wrapper", notes);
  const background = readMjmlBackgroundImage(
    (name) => attrs[name],
    "Wrapper",
    boxWidth,
  );

  for (const name of WRAPPER_BORDER_ATTRIBUTES) {
    const raw = attrs[name];
    if (raw === undefined) continue;
    notes.push(
      `Wrapper ${name} "${raw.trim()}" has no Templatical equivalent; dropped.`,
    );
  }
  if (background) notes.push(...background.notes);

  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    padding,
    ...(borderRadius ? { borderRadius } : {}),
    ...(background ? { backgroundImage: background.image } : {}),
  };
}

/**
 * Each section gets its own band object and band image, so editing one
 * section's image leaves the others alone. `padding` and `borderRadius` stay
 * shared, as in the other importers.
 */
function copyWrapper(wrapper: SectionWrapper): SectionWrapper {
  const image = wrapper.backgroundImage;
  return {
    ...wrapper,
    ...(image
      ? { backgroundImage: { ...image, position: { ...image.position } } }
      : {}),
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
  const notes: string[] = [];
  const wrapper = readWrapper(attrs, notes, ctx.containerWidth);

  const sections = childElements($el, ctx.$).filter(($k) => {
    const tag = tagOf($k[0]);
    return tag === "mj-section" || tag === "mj-hero";
  });

  if (sections.length === 0) {
    entries.push({
      sourceTag: "mj-wrapper",
      templaticalBlockType: null,
      status: "skipped",
      note: "An <mj-wrapper> with no <mj-section> or <mj-hero> children produces nothing.",
    });
    return [];
  }

  if (sections.length > 1) {
    notes.unshift(
      `An <mj-wrapper> holding ${sections.length} sections was applied to each of them — Templatical has no multi-section band.`,
    );
  }

  // A wrapper is not a block of its own, so it gets an entry only when it has
  // something to report.
  if (notes.length > 0) {
    entries.push({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "section",
      status: "approximated",
      note: notes.join(" "),
    });
  }

  return sections.flatMap(($section) =>
    tagOf($section[0]) === "mj-hero"
      ? buildHero($section, ctx, entries, copyWrapper(wrapper))
      : buildSection($section, ctx, entries, copyWrapper(wrapper)),
  );
}
