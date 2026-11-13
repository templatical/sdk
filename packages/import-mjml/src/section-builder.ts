import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  COLUMN_LAYOUT_PERCENTS,
  columnWidthsIssue,
  createSectionBlock,
  getColumnCount,
  resolveHero,
  sectionColumnPercents,
} from "@templatical/types";
import type {
  Block,
  ColumnLayout,
  SectionBlock,
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
  mjmlHorizontalInset,
  mjmlVerticalPadding,
  readBorder,
  readBorderRadius,
  type ConvertContext,
} from "./block-base";
import { planSiblings } from "./display-condition";
import type { ImportReportEntry } from "./types";

/**
 * Preset match order. The first shape within `WIDTH_TOLERANCE` wins, so this
 * stays the order the importer has always tried.
 */
const LAYOUT_MATCH_ORDER: ColumnLayout[] = [
  "1",
  "2",
  "1-2",
  "2-1",
  "1-3",
  "3-1",
  "3",
  "1-2-1",
  "4",
];

const LAYOUT_SHAPES: Array<{
  layout: ColumnLayout;
  percents: readonly number[];
}> = LAYOUT_MATCH_ORDER.map((layout) => ({
  layout,
  percents: COLUMN_LAYOUT_PERCENTS[layout],
}));

/** Percentage points of drift tolerated per column before a match is inexact. */
const WIDTH_TOLERANCE = 2;

function evenLayout(count: number): ColumnLayout {
  if (count === 3) return "3";
  if (count === 4) return "4";
  return "2";
}

/**
 * Resolve MJML column widths to a layout.
 *
 * A width list that fits a preset within `WIDTH_TOLERANCE` keeps that preset.
 * One column is always `"1"`: exact at 100%, and approximated otherwise.
 * An absent width is MJML's default, the parent divided by the column count,
 * not the space the stated widths leave. Two, three or four columns that fit
 * none keep the even preset of that count plus `columnWidths` scaled to 100.
 * That match is exact when the resolved shares already total 100 within half
 * a point; otherwise scaling changes the source layout and the match is not
 * exact. Shares that cannot be stored (a non-positive width) keep that even
 * preset and are approximated. Five or more columns collapse to `"4"`;
 * `exact: false` tells the caller to report it.
 */
export function matchColumnLayout(percents: Array<number | null>): {
  layout: ColumnLayout;
  exact: boolean;
  columnWidths?: number[];
} {
  const count = percents.length;
  if (count === 0) return { layout: "1", exact: true };

  // No widths at all is MJML's "distribute equally", which is exactly what the
  // n-column layout means — not a missing value to approximate around.
  if (percents.every((p) => p === null)) {
    if (count === 1) return { layout: "1", exact: true };
    if (count === 2) return { layout: "2", exact: true };
    if (count === 3) return { layout: "3", exact: true };
    if (count === 4) return { layout: "4", exact: true };
    return { layout: "4", exact: false };
  }

  if (count > 4) return { layout: "4", exact: false };

  // An absent width is MJML's default: the parent width divided by the
  // column count, whatever its siblings state. The equal preset above is
  // only for a row whose every width is absent.
  const fallback = 100 / count;
  const resolved = percents.map((percent) => percent ?? fallback);

  const sameCount = LAYOUT_SHAPES.filter(
    (shape) => shape.percents.length === count,
  );

  for (const shape of sameCount) {
    const fits = shape.percents.every(
      (want, i) => Math.abs(want - resolved[i]!) <= WIDTH_TOLERANCE,
    );
    if (fits) return { layout: shape.layout, exact: true };
  }

  if (count === 1) return { layout: "1", exact: false };

  const layout = evenLayout(count);
  if (columnWidthsIssue({ columns: layout, columnWidths: resolved }) !== null) {
    return { layout, exact: false };
  }
  // Scaling to 100 changes a row MJML would leave short or long. Half a
  // point treats a binary-sum of shares that already are 100 as exact.
  const total = resolved.reduce((sum, share) => sum + share, 0);
  return {
    layout,
    exact: Math.abs(total - 100) <= 0.5,
    columnWidths: sectionColumnPercents({
      columns: layout,
      columnWidths: resolved,
    }),
  };
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
 * A column's width as a percentage of the section's inner box, or `null`
 * when the column carries no definite width of its own.
 *
 * `mj-column` accepts either a percentage or a px length. A px width is
 * real geometry against that inner box — the width the section was given,
 * less its horizontal padding and drawn side borders — so it participates
 * in `matchColumnLayout` as a known share.
 */
function columnWidthPercent(
  value: string | undefined,
  innerWidth: number,
): number | null {
  const percent = parsePercent(value);
  if (percent !== null) return percent;

  const px = parseDefinitePx(value);
  return px !== null && innerWidth > 0 ? (px / innerWidth) * 100 : null;
}

function isFullWidthAttr(value: string | undefined): boolean {
  return value === "full-width";
}

/**
 * A full-width section's own background is the viewport band, so it moves
 * onto the wrapper and the section stays transparent over it.
 *
 * A wrapper that already paints keeps that paint: two stacked full-bleed
 * backgrounds cannot both be represented, and the wrapper's wins. A wrapper
 * that is not itself full width holds the section inside the email, so the
 * section keeps its background.
 */
function liftSectionBand(
  section: SectionBlock,
  fullWidth: boolean,
  wrapper: SectionWrapper | undefined,
): SectionWrapper | undefined {
  if (!fullWidth) return wrapper;
  const color = section.styles.backgroundColor;
  const image = section.backgroundImage;
  if (!color && !image) return wrapper;
  if (wrapper && (wrapper.backgroundColor || wrapper.backgroundImage)) {
    return wrapper;
  }
  if (wrapper && wrapper.fullWidth !== true) return wrapper;
  if (color) delete section.styles.backgroundColor;
  if (image) delete section.backgroundImage;
  return {
    ...(wrapper ?? {}),
    ...(color ? { backgroundColor: color } : {}),
    ...(image ? { backgroundImage: image } : {}),
    fullWidth: true,
  };
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
  // The box MJML hands the columns: the section's container, less its own
  // horizontal padding and drawn side borders. A wrapper has already taken
  // its inset off `contentWidth`.
  const innerWidth = Math.floor(ctx.contentWidth) - mjmlHorizontalInset(attrs);
  const percents = rawWidths.map((width) =>
    columnWidthPercent(width, innerWidth),
  );
  const matched = matchColumnLayout(percents);
  const { layout, exact } = matched;
  const slots = getColumnCount(layout);
  const widthPercents = sectionColumnPercents({
    columns: layout,
    columnWidths: matched.columnWidths,
  });

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
        `Column widths ${shown} have no exact Templatical layout; resolved to "${layout}".${columns.length > 4 ? " Templatical supports up to four columns." : ""}`,
      ];
  const borderRadius = readBorderRadius(attrs, "Section", notes);
  const border = readBorder(attrs, "Section", notes);
  const background = readMjmlBackgroundImage(
    (name) => attrs[name],
    "Section",
    ctx.containerWidth,
  );
  if (background) notes.push(...background.notes);
  const sectionFields = baseFields(attrs, "native");
  // `innerWidth` is the room the renderer will give the section's columns,
  // so an image can tell whether it fills its column on phones.
  entries.push({
    sourceTag: "mj-section",
    templaticalBlockType: "section",
    status: notes.length > 0 ? "approximated" : "converted",
    ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
  });

  const children: Block[][] = Array.from({ length: slots }, () => []);

  columns.forEach(($column, index) => {
    // A fifth or later column folds into the last slot rather than becoming an html
    // block: its content converts perfectly and only the geometry is lost.
    const slot = Math.min(index, slots - 1);
    const { left, right } = parsePaddingShorthand(columnAttrs[index].padding);
    const columnCtx: ConvertContext = {
      ...ctx,
      containerWidth: Math.round(
        (ctx.containerWidth * (widthPercents[slot] ?? 100)) / 100,
      ),
      contentWidth: Math.floor(
        (innerWidth * (widthPercents[slot] ?? 100)) / 100,
      ),
      columnPadding: left + right,
    };
    children[slot].push(...convertColumnChildren($column, columnCtx, entries));
  });

  const section = createSectionBlock({
    columns: layout,
    ...(matched.columnWidths ? { columnWidths: matched.columnWidths } : {}),
    children,
    ...(grouped ? { stackOnMobile: false } : {}),
    ...(borderRadius ? { borderRadius } : {}),
    ...(border ? { border } : {}),
    ...(background ? { backgroundImage: background.image } : {}),
    // "native": mj-section is the one element whose own background-color
    // attribute is its container fill (renderers/section.ts:32) — every other
    // baseFields caller reads container-background-color instead.
    ...sectionFields,
  });
  const band = liftSectionBand(
    section,
    isFullWidthAttr(attrs["full-width"]),
    wrapper,
  );
  if (band) section.wrapper = band;

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
  // The box the renderer draws the hero at: the band's floored width.
  const heroBox = Math.floor(ctx.contentWidth);
  const read = readMjmlHero(
    (name) => attrs[name],
    "Hero",
    heroBox,
    mjmlVerticalPadding(attrs),
  );
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

  // The room the renderer gives the content, measured as buildSection
  // measures a section's: the band's floored width less the hero's side
  // padding. No border comes off: mj-hero draws none, and the section built
  // here has none to draw if the renderer falls back to a regular section.
  // `containerWidth` follows the renderer too: an applied hero renders a
  // `"full"` image at its box (`renderHero` in renderers/section.ts), a
  // fallback section at the nominal width.
  const fields = baseFields(attrs, "native");
  const heroPadding = mjmlHorizontalInset(attrs);
  const applied = resolveHero({
    columns: "1",
    hero: read.hero ?? undefined,
    backgroundImage: read.image ?? undefined,
  })?.applied;

  const children = convertColumnChildren(
    $el,
    {
      ...ctx,
      containerWidth: applied ? heroBox : ctx.containerWidth,
      contentWidth: heroBox - heroPadding,
      columnPadding: heroPadding,
    },
    entries,
  );

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
  const fullWidth = isFullWidthAttr(attrs["full-width"]);

  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    padding,
    ...(borderRadius ? { borderRadius } : {}),
    ...(background ? { backgroundImage: background.image } : {}),
    ...(fullWidth ? { fullWidth: true } : {}),
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

  const bandCtx: ConvertContext = {
    ...ctx,
    contentWidth: Math.floor(ctx.contentWidth) - mjmlHorizontalInset(attrs),
  };
  return sections.flatMap(($section) =>
    tagOf($section[0]) === "mj-hero"
      ? buildHero($section, bandCtx, entries, copyWrapper(wrapper))
      : buildSection($section, bandCtx, entries, copyWrapper(wrapper)),
  );
}
