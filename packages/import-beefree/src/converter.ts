import {
  defaultLocaleOption,
  localeTag,
  registerLocales,
  text,
  warn,
} from "./localization";
import {
  BUILT_IN_FONT_STACKS,
  canonicalFontStack,
  createSectionBlock,
  createDefaultTemplateContent,
  isGenericFontFamily,
  isImage,
  parseFontFamilies,
  toBorderCss,
} from "@templatical/types";
import type {
  BackgroundImage,
  Block,
  BlockVisibility,
  BorderStyle,
  BorderValue,
  ColumnLayout,
  CustomFont,
  ImageBlock,
  SpacingValue,
  TemplateContent,
} from "@templatical/types";
import type {
  BeeFreeTemplate,
  BeeFreeeRow,
  BeeFreeeColumn,
  BeeFreeeWebFont,
  ImportResult,
  ImportReport,
  ImportReportEntry,
} from "./types";
import {
  convertModule,
  FALLBACK_TEXT_COLOR,
  skippedModuleEntry,
  type ModuleContext,
} from "./block-mapper";
import { decodeEntitiesInTokens } from "./merge-tokens";
import {
  parsePxValue,
  parseColor,
  parseBorderTop,
  extractPadding,
  isTransparentColor,
  readBeefreeBackgroundImage,
} from "./style-parser";

export interface ConvertBeeFreeOptions {
  /** Used when the source declares no default language. */
  defaultLocale?: string;
}

/**
 * A column's share of BeeFree's 12-column grid. An omitted value counts as 6,
 * half the grid, which is what a 2-column row uses when neither side states one.
 */
function columnUnits(column: BeeFreeeColumn): number {
  const value = column["grid-columns"];
  return typeof value === "number" && Number.isFinite(value) ? value : 6;
}

function gridLabel(columns: BeeFreeeColumn[]): string {
  return columns.map(columnUnits).join("-");
}

function columnsEqual(columns: BeeFreeeColumn[]): boolean {
  const first = columnUnits(columns[0]);
  return columns.every((column) => columnUnits(column) === first);
}

/**
 * Thousandths of the left column's share. 8/12 and 2/3 both land on 667 and
 * 7/12 lands on 583, so an exact layout and a near one stay apart.
 */
function ratioMilli(left: number, total: number): number {
  return Math.round((left / total) * 1000);
}

function isExactLayout(
  layout: Exclude<ColumnLayout, "1" | "3">,
  left: number,
  total: number,
): boolean {
  const milli = ratioMilli(left, total);
  if (layout === "2") return milli === 500;
  if (layout === "2-1") return milli === 667;
  return milli === 333;
}

function noteSnappedRatio(
  columns: BeeFreeeColumn[],
  layout: ColumnLayout,
  warnings: string[],
): void {
  warnings.push(
    `Column ratio ${gridLabel(columns)} was mapped to the nearest layout "${layout}".`,
  );
}

/**
 * Nearest two-column layout, in the same thousandths as `isExactLayout`.
 * `2` is listed first, so an equal distance stays on the even split. 7/12
 * rounds to 583: 83 from even, 84 from 2/3, so the narrower share is not
 * squeezed to a third.
 */
function nearestTwoColumn(
  left: number,
  total: number,
): Exclude<ColumnLayout, "1" | "3"> {
  const milli = ratioMilli(left, total);
  const choices: Array<[Exclude<ColumnLayout, "1" | "3">, number]> = [
    ["2", 500],
    ["2-1", 667],
    ["1-2", 333],
  ];
  let best: Exclude<ColumnLayout, "1" | "3"> = "2";
  let bestDistance = Math.abs(milli - 500);
  for (const [layout, target] of choices) {
    const distance = Math.abs(milli - target);
    if (distance < bestDistance) {
      best = layout;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Determines the Templatical ColumnLayout from BeeFree column grid values.
 * A split that is not exactly `2`, `1-2`, `2-1` or an even `3` keeps the
 * nearest of those and records one warning naming the source ratio. Four or
 * more columns flatten to one column, with that ratio in the same warning.
 */
function resolveColumnLayout(
  columns: BeeFreeeColumn[],
  warnings: string[],
): ColumnLayout | null {
  if (columns.length === 1) return null; // Single column — no section wrapper needed
  if (columns.length === 3) {
    if (!columnsEqual(columns)) noteSnappedRatio(columns, "3", warnings);
    return "3";
  }

  if (columns.length === 2) {
    const left = columnUnits(columns[0]);
    const right = columnUnits(columns[1]);
    const total = left + right;
    if (total <= 0) {
      noteSnappedRatio(columns, "2", warnings);
      return "2";
    }
    const layout = nearestTwoColumn(left, total);
    if (!isExactLayout(layout, left, total)) {
      noteSnappedRatio(columns, layout, warnings);
    }
    return layout;
  }

  if (columns.length >= 4) {
    warnings.push(
      `Row with ${columns.length} columns (${gridLabel(columns)}) was flattened to a single column. BeeFree supports arbitrary columns, but Templatical supports up to 3.`,
    );
    return null; // Flatten to single column
  }

  return "2";
}

/**
 * Column widths in px for a layout, mirroring `renderer/src/columns.ts`, and
 * floored as the renderer floors the width it hands each column.
 */
function columnPixels(layout: ColumnLayout, bodyWidth: number): number[] {
  switch (layout) {
    case "2":
      return [bodyWidth * 0.5, bodyWidth * 0.5].map(Math.floor);
    case "3":
      return [bodyWidth / 3, bodyWidth / 3, bodyWidth / 3].map(Math.floor);
    case "1-2":
      return [bodyWidth / 3, (bodyWidth * 2) / 3].map(Math.floor);
    case "2-1":
      return [(bodyWidth * 2) / 3, bodyWidth / 3].map(Math.floor);
    default:
      return [Math.floor(bodyWidth)];
  }
}

/**
 * Converts all modules in a column to Templatical blocks.
 */
function convertColumnModules(
  column: BeeFreeeColumn,
  context: ModuleContext,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const blocks: Block[] = [];

  for (const module of column.modules) {
    const skipped = skippedModuleEntry(module);
    if (skipped) {
      entries.push(skipped);
      continue;
    }
    const { block, entry, extras } = convertModule(module, warnings, context);
    blocks.push(block);
    if (extras?.length) blocks.push(...extras);
    entries.push(entry);
  }

  return blocks;
}

/**
 * The image a row's section paints. `content.style` is the content area a
 * section paints, so its image maps exactly. `container.style` is the
 * full-width band: it shows through only while the content area has neither
 * an image nor a colour, and then the section paints it at the content
 * width; otherwise it's dropped. Losses go to `warnings`, since rows have no
 * report entry.
 */
function resolveRowBackgroundImage(
  row: BeeFreeeRow,
  rowBg: string,
  width: number,
  warnings: string[],
): BackgroundImage | undefined {
  const content = readBeefreeBackgroundImage(row.content?.style, "Row", width);
  const band = readBeefreeBackgroundImage(
    row.container?.style,
    "Row container",
    width,
  );
  // A background URL is a copied string and can carry a merge tag.
  if (content) content.image.url = decodeEntitiesInTokens(content.image.url);
  if (band) band.image.url = decodeEntitiesInTokens(band.image.url);

  if (content) {
    warnings.push(...content.notes);
    if (band) {
      warnings.push(
        `Row container background image "${band.image.url}" outside the content width was dropped; the section keeps the content background image.`,
      );
    }
    return content.image;
  }
  if (!band) return undefined;
  if (rowBg) {
    warnings.push(
      `Row container background image "${band.image.url}" outside the content width was dropped; the section keeps the content background ${rowBg}.`,
    );
    return undefined;
  }
  warnings.push(
    ...band.notes,
    `Row container background image "${band.image.url}" spans the full width in BeeFree; the section paints it at the content width.`,
  );
  return band.image;
}

function zeroPadding(): SpacingValue {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function addPadding(base: SpacingValue, extra: SpacingValue): SpacingValue {
  return {
    top: base.top + extra.top,
    right: base.right + extra.right,
    bottom: base.bottom + extra.bottom,
    left: base.left + extra.left,
  };
}

function hasPadding(padding: SpacingValue): boolean {
  return (
    padding.top !== 0 ||
    padding.right !== 0 ||
    padding.bottom !== 0 ||
    padding.left !== 0
  );
}

const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;

function toBorderStyle(value: string | undefined): BorderStyle {
  if (value === "dashed" || value === "dotted" || value === "solid")
    return value;
  return "solid";
}

/**
 * A column background that paints. Fully transparent is unset, the same way
 * a border that paints nothing is.
 */
function columnBackgroundColor(
  style: Record<string, string> | undefined,
): string {
  const raw = style?.["background-color"];
  if (isTransparentColor(raw)) return "";
  return parseColor(raw);
}

/**
 * A column or row style's border as a section border. A side that paints
 * nothing has width 0. `undefined` when no side is drawn.
 */
function columnBorder(
  style: Record<string, string> | undefined,
): BorderValue | undefined {
  if (!style) return undefined;
  let drawn = false;
  const border = {} as BorderValue;
  for (const side of BORDER_SIDES) {
    const raw = style[`border-${side}`];
    const parsed = raw ? parseBorderTop(raw) : undefined;
    const paints = parsed !== undefined && parsed.drawn && parsed.width > 0;
    if (paints) drawn = true;
    border[side] = {
      width: paints ? parsed.width : 0,
      style: toBorderStyle(parsed?.style),
      color: parsed?.color || "#000000",
    };
  }
  return drawn ? border : undefined;
}

function isFlag(value: string | boolean | undefined): boolean {
  return value === true || value === "true";
}

function rowVisibility(row: BeeFreeeRow): BlockVisibility | undefined {
  const computed = row.content?.computedStyle;
  const hideMobile = isFlag(computed?.hideContentOnMobile);
  const hideDesktop = isFlag(computed?.hideContentOnDesktop);
  if (!hideMobile && !hideDesktop) return undefined;
  return { desktop: !hideDesktop, mobile: !hideMobile };
}

function rowOptsOutOfStack(row: BeeFreeeRow): boolean {
  const value = row.content?.computedStyle?.rowColStackOnMobile;
  return value === false || value === "false";
}

function sameBorder(a: BorderValue, b: BorderValue): boolean {
  return BORDER_SIDES.every(
    (side) =>
      a[side].width === b[side].width &&
      a[side].style === b[side].style &&
      a[side].color === b[side].color,
  );
}

const ROW_BORDER_DROPPED =
  "Row border was dropped; the column border is kept on the section.";

const ROW_STACK_DROPPED =
  "rowColStackOnMobile false was dropped; Templatical keeps columns side by side only on a 2- or 3-column section.";

interface RowFrame {
  visibility?: BlockVisibility;
  stackOnMobile?: false;
  wrapper?: { backgroundColor: string };
  border?: BorderValue;
}

/**
 * Row chrome the section can hold. The container colour is the band outside
 * the content box (`wrapper`); the section fill stays the content colour the
 * caller already chose. A band the same colour as that fill adds nothing. A
 * column border already chosen for the section wins over the row border.
 */
function rowFrame(
  row: BeeFreeeRow,
  sectionBackground: string,
  columnBorderValue: BorderValue | undefined,
  applyStack: boolean,
  warnings: string[],
): RowFrame {
  const visibility = rowVisibility(row);
  const band = parseColor(row.container?.style?.["background-color"]);
  const wrapper =
    band && band !== sectionBackground ? { backgroundColor: band } : undefined;

  let border = columnBorderValue;
  const rowBorder = columnBorder(row.content?.style);
  if (rowBorder) {
    if (!border) border = rowBorder;
    else if (!sameBorder(border, rowBorder)) warnings.push(ROW_BORDER_DROPPED);
  }

  let stackOnMobile: false | undefined;
  if (rowOptsOutOfStack(row)) {
    if (applyStack) stackOnMobile = false;
    else warnings.push(ROW_STACK_DROPPED);
  }

  return {
    ...(visibility ? { visibility } : {}),
    ...(stackOnMobile === false ? { stackOnMobile } : {}),
    ...(wrapper ? { wrapper } : {}),
    ...(border ? { border } : {}),
  };
}

function frameNeedsSection(frame: RowFrame): boolean {
  return (
    frame.visibility !== undefined ||
    frame.wrapper !== undefined ||
    frame.border !== undefined
  );
}

/**
 * `content.style.width` is the content box. A section has no width of its
 * own, so a value other than the email width is reported and left.
 */
function warnIfContentWidthDiffers(
  row: BeeFreeeRow,
  emailWidth: number,
  warnings: string[],
): void {
  const raw = row.content?.style?.width;
  if (typeof raw !== "string" || raw.trim() === "") return;
  const px = parsePxValue(raw);
  if (px > 0 && px === emailWidth) return;
  const shown = px > 0 ? `${px}px` : `"${raw.trim()}"`;
  warnings.push(
    `Row content width ${shown} differs from the email width ${emailWidth}px. A section has no width of its own, so the row keeps the email width.`,
  );
}

const COLUMN_BOX_DROPPED =
  "Column background/border was dropped; a multi-column row has no per-column box.";

/**
 * The percentages the renderer emits for a multi-column section
 * (`getWidthPercentages`). 33.33% of 600 is 199; the last column is 33.34%.
 */
const COLUMN_CONTENT_PERCENTS: Record<Exclude<ColumnLayout, "1">, string[]> = {
  "2": ["50%", "50%"],
  "3": ["33.33%", "33.33%", "33.34%"],
  "1-2": ["33.33%", "66.67%"],
  "2-1": ["66.67%", "33.33%"],
};

function drawnSide(side: BorderValue["left"] | undefined): number {
  return toBorderCss(side) === null ? 0 : Math.trunc(side!.width);
}

/**
 * BeeFree's grid share of the section box, in whole pixels. The same floor
 * the renderer uses, so an exact layout and this share differ only where
 * the percentage rounding does.
 */
function columnShareWidths(columns: BeeFreeeColumn[], box: number): number[] {
  const units = columns.map(columnUnits);
  const total = units.reduce((sum, share) => sum + share, 0);
  if (total <= 0) {
    const each = Math.floor(box / Math.max(columns.length, 1));
    return columns.map(() => each);
  }
  return units.map((share) => Math.floor((box * share) / total));
}

/** True when `layout` is not the source ratio, so a column may be narrower. */
function layoutSnaps(
  columns: BeeFreeeColumn[],
  layout: Exclude<ColumnLayout, "1">,
): boolean {
  if (layout === "3") return !columnsEqual(columns);
  const total = columns.reduce((sum, column) => sum + columnUnits(column), 0);
  return !isExactLayout(layout, columnUnits(columns[0]!), total);
}

/**
 * A snapped column is narrower than its grid share. The missing pixels come
 * back from the padding that faces the next column, and the outer edge stays.
 * Nothing is taken past 0, and a wider column is left alone.
 */
function giveBackInnerPadding(
  blocks: Block[],
  deficit: number,
  sides: Array<"left" | "right">,
): void {
  if (deficit <= 0) return;
  for (const block of blocks) {
    const padding = block.styles.padding;
    let remaining = deficit;
    for (const side of sides) {
      if (remaining <= 0) break;
      const have = padding[side];
      if (have <= 0) continue;
      const give = Math.min(remaining, have);
      padding[side] = have - give;
      remaining -= give;
    }
  }
}

/**
 * Whole pixels MJML gives each column's content. A multi-column section
 * imported here has no padding of its own; a row border still shrinks the box.
 */
function renderedColumnContentWidths(
  layout: Exclude<ColumnLayout, "1">,
  bodyWidth: number,
  border: BorderValue | undefined,
): number[] {
  const sectionBox =
    Math.floor(bodyWidth) - drawnSide(border?.left) - drawnSide(border?.right);
  return COLUMN_CONTENT_PERCENTS[layout].map((width) =>
    Math.floor((sectionBox * parseFloat(width)) / 100),
  );
}

/**
 * True when the renderer would emit `fluid-on-mobile` on its own: `"full"`,
 * or a pixel width at or above the room inside the image's side padding and
 * border.
 */
function imageFillsColumn(
  block: ImageBlock,
  columnContentWidth: number,
): boolean {
  const padding = block.styles.padding;
  const room =
    Math.floor(columnContentWidth) -
    Math.trunc(padding.left) -
    Math.trunc(padding.right) -
    drawnSide(block.border?.left) -
    drawnSide(block.border?.right);
  return block.width === "full" || block.width >= room;
}

/**
 * BeeFree does not widen an image on a phone when the image sits in a column
 * narrower than the email. Pin those that fill their column, which is when
 * the renderer would stretch them. A full-width row stays on the automatic
 * rule.
 */
function keepColumnImagesAtDesktopWidth(
  blocks: Block[],
  columnContentWidth: number,
): void {
  for (const block of blocks) {
    if (!isImage(block) || block.fluidOnMobile !== undefined) continue;
    if (imageFillsColumn(block, columnContentWidth)) {
      block.fluidOnMobile = false;
    }
  }
}

/** One warning per row when a column's background or border has nowhere to go. */
function warnIfColumnBoxDropped(
  columns: BeeFreeeColumn[],
  warnings: string[],
): void {
  const dropped = columns.some((column) => {
    const style = column.style;
    return (
      columnBackgroundColor(style) !== "" || columnBorder(style) !== undefined
    );
  });
  if (dropped) warnings.push(COLUMN_BOX_DROPPED);
}

/**
 * Column padding has no per-column box. Left and right sit on every module,
 * top on the first and bottom on the last, so the stack keeps the column's
 * inset.
 */
function foldColumnPadding(blocks: Block[], padding: SpacingValue): void {
  if (blocks.length === 0 || !hasPadding(padding)) return;
  const last = blocks.length - 1;
  blocks.forEach((block, index) => {
    const own = block.styles.padding;
    own.left += padding.left;
    own.right += padding.right;
    if (index === 0) own.top += padding.top;
    if (index === last) own.bottom += padding.bottom;
  });
}

/**
 * Processes a single BeeFree row into one or more Templatical blocks.
 */
function processRow(
  row: BeeFreeeRow,
  settings: TemplateContent["settings"],
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const columns = row.columns;
  if (!columns || columns.length === 0) return [];

  // Track locked/synced metadata
  if (row.locked) {
    warnings.push(
      "A locked row was imported. Lock metadata was dropped; content is preserved.",
    );
  }
  if (row.synced) {
    warnings.push(
      "A synced row was imported. Sync metadata was dropped; content is preserved.",
    );
  }

  warnIfContentWidthDiffers(row, settings.width, warnings);

  const layout = resolveColumnLayout(columns, warnings);

  // The content colour is the inner box. The container colour, when it
  // differs, is the band outside that box.
  const rowBg = parseColor(row.content?.style?.["background-color"]);
  const backgroundImage = resolveRowBackgroundImage(
    row,
    rowBg,
    settings.width,
    warnings,
  );

  if (layout === null || layout === "1") {
    // Single column, or 4+ columns flattened onto the body width.
    const context = {
      columnWidth: settings.width,
      textColor: settings.textColor,
    };
    if (columns.length === 1) {
      const column = columns[0];
      const blocks = convertColumnModules(column, context, entries, warnings);
      // The column is the inner box: its padding adds to the row's (none is
      // mapped, so the section starts at 0) and its background replaces the
      // row's where it is set.
      const padding = addPadding(zeroPadding(), extractPadding(column.style));
      const backgroundColor = columnBackgroundColor(column.style) || rowBg;
      const frame = rowFrame(
        row,
        backgroundColor,
        columnBorder(column.style),
        false,
        warnings,
      );
      // A background, a border, padding or row chrome can't survive on bare modules.
      if (
        backgroundColor ||
        backgroundImage ||
        hasPadding(padding) ||
        frameNeedsSection(frame)
      ) {
        return [
          createSectionBlock({
            columns: "1",
            children: [blocks],
            styles: {
              padding,
              ...(backgroundColor ? { backgroundColor } : {}),
            },
            ...(backgroundImage ? { backgroundImage } : {}),
            ...frame,
          }),
        ];
      }
      return blocks;
    }

    const blocks: Block[] = [];
    for (const column of columns) {
      const converted = convertColumnModules(
        column,
        context,
        entries,
        warnings,
      );
      foldColumnPadding(converted, extractPadding(column.style));
      blocks.push(...converted);
    }
    warnIfColumnBoxDropped(columns, warnings);
    const frame = rowFrame(row, rowBg, undefined, false, warnings);
    if (rowBg || backgroundImage || frameNeedsSection(frame)) {
      return [
        createSectionBlock({
          columns: "1",
          children: [blocks],
          styles: {
            padding: zeroPadding(),
            ...(rowBg ? { backgroundColor: rowBg } : {}),
          },
          ...(backgroundImage ? { backgroundImage } : {}),
          ...frame,
        }),
      ];
    }
    return blocks;
  }

  // Multi-column — wrap in a SectionBlock. Each column's padding folds into
  // its modules; a column background or border has no per-column box.
  const widths = columnPixels(layout, settings.width);
  const children: Block[][] = columns.map((col, index) => {
    const blocks = convertColumnModules(
      col,
      { columnWidth: widths[index], textColor: settings.textColor },
      entries,
      warnings,
    );
    foldColumnPadding(blocks, extractPadding(col.style));
    return blocks;
  });
  warnIfColumnBoxDropped(columns, warnings);
  const frame = rowFrame(row, rowBg, undefined, true, warnings);
  const contentWidths = renderedColumnContentWidths(
    layout,
    settings.width,
    frame.border,
  );
  const sectionBox =
    Math.floor(settings.width) -
    drawnSide(frame.border?.left) -
    drawnSide(frame.border?.right);
  const sourceWidths = layoutSnaps(columns, layout)
    ? columnShareWidths(columns, sectionBox)
    : null;
  children.forEach((column, index) => {
    if (sourceWidths) {
      const last = children.length - 1;
      const inner: Array<"left" | "right"> =
        index === 0 ? ["right"] : index === last ? ["left"] : ["right", "left"];
      giveBackInnerPadding(
        column,
        sourceWidths[index]! - (contentWidths[index] ?? 0),
        inner,
      );
    }
    keepColumnImagesAtDesktopWidth(column, contentWidths[index] ?? 0);
  });

  const section = createSectionBlock({
    columns: layout,
    children,
    styles: {
      padding: zeroPadding(),
      ...(rowBg ? { backgroundColor: rowBg } : {}),
    },
    ...(backgroundImage ? { backgroundImage } : {}),
    ...frame,
  });

  return [section];
}

/**
 * Extracts template-level settings from the BeeFree body.
 */
function extractSettings(
  template: BeeFreeTemplate,
): TemplateContent["settings"] {
  const body = template.page.body;
  const contentStyle = body?.content?.style ?? {};
  const computedStyle = body?.content?.computedStyle ?? {};
  const containerStyle = body?.container?.style ?? {};

  // Exports keep the body width in `computedStyle.messageWidth` and usually
  // carry no `style.width`.
  const width =
    parsePxValue(computedStyle.messageWidth) ||
    parsePxValue(contentStyle.width);
  const bgColor =
    parseColor(contentStyle["background-color"]) ||
    parseColor(containerStyle["background-color"]) ||
    "#ffffff";
  const fontFamily = canonicalFontStack(contentStyle["font-family"]) || "Arial";
  const linkColor = parseColor(computedStyle.linkColor);

  return {
    width: width || 600,
    backgroundColor: bgColor,
    textColor: parseColor(contentStyle.color) || FALLBACK_TEXT_COLOR,
    ...(linkColor ? { linkColor } : {}),
    // BeeFree underlines per link, in the link's own markup, and has no
    // template-wide switch, so links take the browser default: underlined.
    linkUnderline: true,
    fontFamily,
    locale: "en",
  };
}

/**
 * Converts a BeeFree template JSON to Templatical TemplateContent.
 *
 * @param template - The parsed BeeFree JSON object
 * @returns An ImportResult with the converted content and a detailed report
 *
 * @example
 * ```ts
 * import { convertBeeFreeTemplate } from '@templatical/import-beefree';
 *
 * const beeFreeJson = JSON.parse(fileContent);
 * const { content, report } = convertBeeFreeTemplate(beeFreeJson);
 *
 * // Use the content with the editor
 * const editor = init({ container: '#editor', content });
 *
 * // Check the report for any issues
 * console.log(report.summary);
 * console.log(report.warnings);
 * ```
 */
export function convertBeeFreeTemplate(
  template: BeeFreeTemplate,
  options: ConvertBeeFreeOptions = {},
): ImportResult {
  // Validate structure
  if (!template?.page?.rows) {
    throw new Error(
      "Invalid BeeFree template: missing page.rows. Ensure you are passing a valid BeeFree JSON export.",
    );
  }

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  // Faces the host has to load. A system stack needs no file, and a face
  // that nothing in the template uses draws no warning.
  const customFonts = collectCustomFonts(template.page.body?.webFonts);
  warnForMissingFontUrls(template, customFonts, warnings);

  // Rows are measured against the width the imported template renders at.
  const settings = extractSettings(template);
  const declared =
    template.page.body?.language?.value ??
    template.page.language?.value ??
    template.language?.value;
  settings.locale =
    (declared ? localeTag(declared, warnings) : null) ??
    defaultLocaleOption(options.defaultLocale, warnings) ??
    "en";
  const meta = template.head?.meta;
  if (typeof meta?.preheader === "string")
    settings.preheaderText = decodeEntitiesInTokens(meta.preheader);
  for (const [code, values] of Object.entries(meta?.translations ?? {})) {
    const locale = localeTag(code, warnings);
    if (!locale) continue;
    for (const key of Object.keys(values)) {
      if (key === "preheader" && typeof values.preheader === "string") {
        text(
          settings,
          locale,
          "preheaderText",
          settings.preheaderText,
          decodeEntitiesInTokens(values.preheader),
        );
      } else {
        warn(
          warnings,
          `Dropped language "${locale}" metadata "${key}": ${["subject", "title", "description"].includes(key) ? "the host owns this field" : "no language mapping for this format"}.`,
        );
      }
    }
  }

  // Process rows
  for (const row of template.page.rows) {
    if (row.empty) continue;
    blocks.push(...processRow(row, settings, entries, warnings));
  }

  // Build template content
  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings,
  };

  registerLocales(content);

  // Build report summary
  const summary = {
    total: entries.length,
    converted: entries.filter((e) => e.status === "converted").length,
    approximated: entries.filter((e) => e.status === "approximated").length,
    htmlFallback: entries.filter((e) => e.status === "html-fallback").length,
    skipped: entries.filter((e) => e.status === "skipped").length,
  };

  const report: ImportReport = { entries, warnings, summary };

  return { content, report, customFonts };
}

/**
 * Families BeeFree ships as system stacks, beyond the built-in web-safe set.
 * They show up as the face itself or as a fallback (`Helvetica Neue`,
 * `Lucida Grande`) and have nothing to download.
 */
const WEB_SAFE_FONTS = new Set<string>([
  ...Object.keys(BUILT_IN_FONT_STACKS),
  "helvetica neue",
  "lucida grande",
  "lucida sans unicode",
  "lucida sans",
  "geneva",
  "times",
  "courier",
  "segoe",
  "segoe ui",
  "baskerville",
]);

/** The first real family in a `font-family` value. `""` for inherit or a generic. */
function declaredFontName(value: string | undefined): string {
  if (!value) return "";
  const named = parseFontFamilies(value).find(
    (family) => !isGenericFontFamily(family),
  );
  return named?.name ?? "";
}

function isWebSafeFont(name: string): boolean {
  return WEB_SAFE_FONTS.has(name.toLowerCase());
}

/**
 * `webFonts` entries a host can load. The name is the first family of
 * `fontFamily` (what the template's CSS names), then `name`. A duplicate
 * name keeps the first URL. A system face, `inherit`, or a blank URL is
 * skipped.
 */
function collectCustomFonts(
  webFonts: BeeFreeeWebFont[] | undefined,
): CustomFont[] {
  const fonts: CustomFont[] = [];
  const seen = new Set<string>();
  for (const font of webFonts ?? []) {
    const url = typeof font.url === "string" ? font.url.trim() : "";
    if (!url) continue;
    const name =
      declaredFontName(font.fontFamily) || declaredFontName(font.name);
    if (!name || isWebSafeFont(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    fonts.push({ name, url });
  }
  return fonts;
}

/** `font-family` values on the body and in modules, not the `webFonts` list. */
function collectUsedFontValues(template: BeeFreeTemplate): string[] {
  const found: string[] = [];
  const take = (value: unknown): void => {
    if (typeof value === "string") {
      // Stop at the attribute's closing quote. A family name may itself be quoted.
      for (const match of value.matchAll(
        /font-family\s*:\s*((?:[^;}"]|"[^"]*")+)/gi,
      )) {
        found.push(match[1].trim());
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) take(item);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "webFonts") continue;
      if (key === "font-family" && typeof child === "string") found.push(child);
      else take(child);
    }
  };
  take(template.page.body?.content);
  take(template.page.rows);
  return found;
}

function warnForMissingFontUrls(
  template: BeeFreeTemplate,
  customFonts: readonly CustomFont[],
  warnings: string[],
): void {
  const loaded = new Set(customFonts.map((font) => font.name.toLowerCase()));
  for (const value of collectUsedFontValues(template)) {
    const name = declaredFontName(value);
    if (!name || isWebSafeFont(name)) continue;
    const key = name.toLowerCase();
    if (loaded.has(key)) continue;
    loaded.add(key);
    warn(
      warnings,
      `Font "${name}" is used but BeeFree provides no URL for it.`,
    );
  }
}
