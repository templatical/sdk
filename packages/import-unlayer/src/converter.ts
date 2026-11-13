import {
  defaultLocaleOption,
  localeTag,
  registerLocales,
  set,
  warn,
} from "./localization";
import {
  COLUMN_LAYOUT_PERCENTS,
  columnWidthsIssue,
  createSectionBlock,
  createDefaultTemplateContent,
  sectionColumnPercents,
} from "@templatical/types";
import type {
  BackgroundImage,
  Block,
  ColumnLayout,
  SectionWrapper,
  TemplateContent,
} from "@templatical/types";
import type {
  UnlayerTemplate,
  UnlayerRow,
  UnlayerColumn,
  ImportResult,
  ImportReport,
  ImportReportEntry,
} from "./types";
import {
  convertContent,
  DEFAULT_BODY_WIDTH,
  FALLBACK_TEXT_COLOR,
  skippedContentEntry,
} from "./block-mapper";
import type { ContentContext } from "./block-mapper";
import {
  parsePxValue,
  parseColor,
  parseFontFamily,
  parsePaddingShorthand,
  readUnlayerBackgroundImage,
} from "./style-parser";

interface ResolvedColumns {
  layout: ColumnLayout;
  columnWidths?: number[];
}

/** The two-, three- and four-column presets, in the order a match is tried. */
const PRESETS: readonly ColumnLayout[] = [
  "2",
  "2-1",
  "1-2",
  "3-1",
  "1-3",
  "3",
  "1-2-1",
  "4",
];

/**
 * The widest gap between a scaled share and a preset's share that still
 * matches: one hundredth, the step `sectionColumnPercents` rounds to, so
 * `[1, 1, 1]` (33.34 / 33.33 / 33.33) is `"3"`. The extra 1e-9 absorbs the
 * float error of subtracting two hundredths.
 */
const PRESET_MATCH = 0.01 + 1e-9;

function evenLayout(count: number): ColumnLayout {
  if (count === 3) return "3";
  if (count === 4) return "4";
  return "2";
}

/**
 * The section layout for a row's `cells`, Unlayer's relative column weights.
 *
 * One cell is `"1"`. Five or more flatten to `"1"` with a warning. Two to
 * four cells keep the preset their scaled shares equal, or the even preset
 * of that count plus `columnWidths`: `[1, 2]` is `"1-2"`, `[6, 2, 2, 2]` is
 * `"4"` with `[50, 16.67, 16.67, 16.66]`. A cell that is not a number above
 * 0 keeps the even preset without `columnWidths`, and warns when the cells
 * total more than 0.
 */
function resolveColumns(cells: number[], warnings: string[]): ResolvedColumns {
  if (cells.length <= 1) return { layout: "1" };
  if (cells.length > 4) {
    warnings.push(
      `Row with ${cells.length} columns was flattened to a single column. Unlayer supports arbitrary columns, but Templatical supports up to four columns.`,
    );
    return { layout: "1" };
  }

  const layout = evenLayout(cells.length);
  if (columnWidthsIssue({ columns: layout, columnWidths: cells }) !== null) {
    const total = cells.reduce((sum, cell) => sum + cell, 0);
    if (total > 0) {
      warnings.push(
        `Row with ${cells.length} columns at ratio ${cells.join(":")} was kept as an even split. A cell that is not above 0 cannot be stored as column widths.`,
      );
    }
    return { layout };
  }

  const percents = sectionColumnPercents({
    columns: layout,
    columnWidths: cells,
  });
  const preset = PRESETS.find((candidate) => {
    const target = COLUMN_LAYOUT_PERCENTS[candidate];
    return (
      target.length === percents.length &&
      target.every(
        (share, index) => Math.abs(share - percents[index]!) <= PRESET_MATCH,
      )
    );
  });
  return preset ? { layout: preset } : { layout, columnWidths: percents };
}

export interface ConvertUnlayerOptions {
  /** Used when the source declares no default language. */
  defaultLocale?: string;
}

/** Each column's share of the body width, by layout. */
const COLUMN_SHARES: Record<ColumnLayout, number[]> = {
  "1": [1],
  "2": [1 / 2, 1 / 2],
  "3": [1 / 3, 1 / 3, 1 / 3],
  "4": [1 / 4, 1 / 4, 1 / 4, 1 / 4],
  "1-2": [1 / 3, 2 / 3],
  "2-1": [2 / 3, 1 / 3],
  "1-3": [1 / 4, 3 / 4],
  "3-1": [3 / 4, 1 / 4],
  "1-2-1": [1 / 4, 1 / 2, 1 / 4],
};

/**
 * A column's px width as the renderer draws it, rounded down: `rowWidth`
 * (the content width less the row's side padding) times the preset's share
 * (a third for `"3"`, `"1-2"` and `"2-1"`), or times the `columnWidths`
 * percentage when the row has one. A column past the layout's last slot
 * takes the whole row width, the renderer's fallback.
 */
function columnWidthAt(
  columns: ResolvedColumns,
  rowWidth: number,
  index: number,
): number {
  if (columns.columnWidths) {
    return Math.floor((rowWidth * (columns.columnWidths[index] ?? 100)) / 100);
  }
  return Math.floor(rowWidth * (COLUMN_SHARES[columns.layout][index] ?? 1));
}

/**
 * Converts all contents in a column to Templatical blocks.
 */
function convertColumnContents(
  column: UnlayerColumn,
  context: ContentContext,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const blocks: Block[] = [];

  for (const content of column.contents ?? []) {
    const skipped = skippedContentEntry(content);
    if (skipped) {
      entries.push(skipped);
      continue;
    }
    const { block, entry } = convertContent(content, warnings, context);
    blocks.push(block);
    entries.push(entry);
  }

  return blocks;
}

/**
 * Where a row's colour and image land.
 *
 * `columnsBackgroundColor` is the content box and stays on the section.
 * `backgroundColor` is the band outside that box. A `backgroundImage` with
 * `fullWidth` left unset or `true` (Unlayer's default) is that same band;
 * `fullWidth: false` is the content box. The band goes on a viewport-wide
 * wrapper. With no content colour the section stays unset, so the band
 * shows through the content box. A wrapper colour is left off when the
 * section keeps its own image: Outlook desktop paints a wrapper colour over
 * that image. Losses go to `warnings`, since rows have no report entry.
 */
function resolveRowPaint(
  row: UnlayerRow,
  width: number,
  warnings: string[],
): {
  backgroundColor?: string;
  backgroundImage?: BackgroundImage;
  wrapper?: SectionWrapper;
} {
  const content = parseColor(row.values?.columnsBackgroundColor);
  const band = parseColor(row.values?.backgroundColor);
  const bg = row.values?.backgroundImage;
  const read = readUnlayerBackgroundImage(bg, "Row", width);
  const imageIsBand = Boolean(read) && bg?.fullWidth !== false;

  let sectionImage: BackgroundImage | undefined;
  const wrapper: SectionWrapper = {};
  if (read && !imageIsBand) {
    warnings.push(...read.notes);
    sectionImage = read.image;
  }
  if (read && imageIsBand) {
    warnings.push(...read.notes);
    wrapper.backgroundImage = read.image;
    wrapper.fullWidth = true;
  }

  if (band) {
    if (sectionImage) {
      warnings.push(
        `Row background ${band} was dropped: Outlook desktop paints a wrapper colour over the section's background image.`,
      );
    } else {
      wrapper.backgroundColor = band;
      wrapper.fullWidth = true;
    }
  }

  const hasWrapper = wrapper.fullWidth === true;
  return {
    ...(content ? { backgroundColor: content } : {}),
    ...(sectionImage ? { backgroundImage: sectionImage } : {}),
    ...(hasWrapper ? { wrapper } : {}),
  };
}

/**
 * Processes a single Unlayer row into one or more Templatical blocks.
 *
 * Each column's px width derives from `settings.width` and the resolved
 * layout; every block also learns the template's `textColor`.
 */
function processRow(
  row: UnlayerRow,
  settings: TemplateContent["settings"],
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const columns = row.columns;
  if (!columns || columns.length === 0) return [];

  const cells = row.cells ?? columns.map(() => 1);
  const resolved = resolveColumns(cells, warnings);
  const layout = resolved.layout;
  // The row's padding insets its columns, so each column's room is its
  // share of the content width less that padding.
  const padding = parsePaddingShorthand(row.values?.padding);
  const innerWidth = Math.max(0, settings.width - padding.left - padding.right);
  const contextAt = (index: number): ContentContext => ({
    columnWidth: columnWidthAt(resolved, innerWidth, index),
    textColor: settings.textColor,
  });

  let children: Block[][];
  if (layout === "1") {
    const merged: Block[] = [];
    for (const column of columns) {
      merged.push(
        ...convertColumnContents(column, contextAt(0), entries, warnings),
      );
    }
    children = [merged];
  } else {
    children = columns.map((col, index) =>
      convertColumnContents(col, contextAt(index), entries, warnings),
    );
  }

  const paint = resolveRowPaint(row, settings.width, warnings);

  const section = createSectionBlock({
    columns: layout,
    ...(resolved.columnWidths ? { columnWidths: resolved.columnWidths } : {}),
    children,
    styles: {
      padding,
      ...(paint.backgroundColor
        ? { backgroundColor: paint.backgroundColor }
        : {}),
    },
    ...(paint.backgroundImage
      ? { backgroundImage: paint.backgroundImage }
      : {}),
    ...(paint.wrapper ? { wrapper: paint.wrapper } : {}),
  });

  const languages = row.values?._languages as
    Record<string, UnlayerRow["values"]> | undefined;
  for (const [code, values] of Object.entries(languages ?? {})) {
    const locale = localeTag(code, warnings);
    if (!locale) continue;
    if (values.backgroundImage?.url !== undefined) {
      const backgroundImage = {
        ...row.values?.backgroundImage,
        ...values.backgroundImage,
      };
      const translatedIsBand = backgroundImage.fullWidth !== false;
      const imagePath = translatedIsBand
        ? "wrapper.backgroundImage"
        : "backgroundImage";
      if (
        typeof backgroundImage.url === "string" &&
        backgroundImage.url.trim() === ""
      ) {
        set(section, locale, imagePath, null);
      } else {
        const read = readUnlayerBackgroundImage(
          backgroundImage,
          "Row",
          settings.width,
        );
        if (read) {
          warnings.push(...read.notes);
          set(section, locale, imagePath, read.image);
        } else if (typeof backgroundImage.url !== "string")
          warn(
            warnings,
            `Dropped language "${locale}" key "backgroundImage.url": unreadable translated URL.`,
          );
      }
    }
    for (const key of Object.keys(values).filter(
      (key) => key !== "backgroundImage",
    ))
      warn(
        warnings,
        `Dropped language "${locale}" key "${key}": no language mapping for this format.`,
      );
  }
  return [section];
}

/**
 * Extracts template-level settings from the Unlayer body values.
 */
function extractSettings(
  template: UnlayerTemplate,
): TemplateContent["settings"] {
  const values = template.body?.values ?? {};

  const width = parsePxValue(values.contentWidth);
  const bgColor = parseColor(values.backgroundColor) || "#ffffff";
  const fontFamily = parseFontFamily(values.fontFamily) || "Arial";
  const textColor = parseColor(values.textColor) || FALLBACK_TEXT_COLOR;
  const linkColor = parseColor(values.linkStyle?.linkColor);
  // An unstated underline is on: Unlayer's default, the browser's and the SDK's.
  const underline = values.linkStyle?.linkUnderline;
  const linkUnderline = typeof underline === "boolean" ? underline : true;
  const preheaderText =
    typeof values.preheaderText === "string" ? values.preheaderText.trim() : "";

  return {
    width: width > 0 ? width : DEFAULT_BODY_WIDTH,
    backgroundColor: bgColor,
    textColor,
    linkUnderline,
    fontFamily,
    locale: "en",
    ...(linkColor ? { linkColor } : {}),
    ...(preheaderText ? { preheaderText } : {}),
  };
}

/**
 * Converts an Unlayer design JSON to Templatical TemplateContent.
 *
 * @param template - The parsed Unlayer JSON object (the result of `editor.saveDesign(...)`)
 * @returns An ImportResult with the converted content and a detailed report
 *
 * @example
 * ```ts
 * import { convertUnlayerTemplate } from '@templatical/import-unlayer';
 *
 * const unlayerJson = JSON.parse(fileContent);
 * const { content, report } = convertUnlayerTemplate(unlayerJson);
 *
 * const editor = init({ container: '#editor', content });
 *
 * console.log(report.summary);
 * console.log(report.warnings);
 * ```
 */
export function convertUnlayerTemplate(
  template: UnlayerTemplate,
  options: ConvertUnlayerOptions = {},
): ImportResult {
  if (!template?.body?.rows) {
    throw new Error(
      "Invalid Unlayer template: missing body.rows. Ensure you are passing a valid Unlayer JSON design (the output of editor.saveDesign).",
    );
  }

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  const headers = template.body.headers ?? [];
  const footers = template.body.footers ?? [];
  const settings = extractSettings(template);
  const defaultLocale = defaultLocaleOption(options.defaultLocale, warnings);
  settings.locale = defaultLocale ?? "en";
  const mappedValues = new Set<unknown>();
  for (const row of [...headers, ...template.body.rows, ...footers]) {
    mappedValues.add(row.values);
    for (const column of row.columns ?? []) {
      for (const element of column.contents ?? [])
        mappedValues.add(element.values);
    }
  }
  const declaredLocales = new Set<string>();
  let hasLanguages = false;
  const scan = (value: unknown, device?: string): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => scan(item, device));
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (key === "_languages" && item && typeof item === "object") {
        hasLanguages = true;
        if (device)
          for (const code of Object.keys(item))
            warn(
              warnings,
              `Dropped language "${code}" in device override "${device}": no language mapping for this format.`,
            );
        if (!device && mappedValues.has(value)) {
          for (const code of Object.keys(item)) {
            const locale = localeTag(code, warnings);
            if (locale && locale !== settings.locale)
              declaredLocales.add(locale);
          }
        }
        if (!device && !mappedValues.has(value)) {
          for (const code of Object.keys(item)) {
            if (localeTag(code, warnings))
              warn(
                warnings,
                `Dropped language "${code}": no language mapping for this format at this element.`,
              );
          }
        }
      } else if (key === "_override" && item && typeof item === "object") {
        for (const [name, override] of Object.entries(item))
          scan(override, name);
      } else scan(item, device);
    }
  };
  scan(template);
  if (hasLanguages && !defaultLocale)
    warnings.push(
      'Unlayer JSON declares no default language; assumed "en". Pass defaultLocale to select another language.',
    );

  const pageImage = template.body.values?.backgroundImage?.url;
  if (typeof pageImage === "string" && pageImage.trim()) {
    warnings.push(
      `The email background image "${pageImage.trim()}" was dropped; Templatical has no email-level background image.`,
    );
  }

  if (headers.length > 0) {
    warnings.push(
      `${headers.length} Unlayer header row(s) were imported as regular rows at the top of the template.`,
    );
    for (const row of headers) {
      blocks.push(...processRow(row, settings, entries, warnings));
    }
  }

  for (const row of template.body.rows) {
    blocks.push(...processRow(row, settings, entries, warnings));
  }

  if (footers.length > 0) {
    warnings.push(
      `${footers.length} Unlayer footer row(s) were imported as regular rows at the bottom of the template.`,
    );
    for (const row of footers) {
      blocks.push(...processRow(row, settings, entries, warnings));
    }
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings,
  };

  registerLocales(content);
  for (const locale of content.settings.locales ?? [])
    declaredLocales.add(locale);
  if (declaredLocales.size) content.settings.locales = [...declaredLocales];

  const summary = {
    total: entries.length,
    converted: entries.filter((e) => e.status === "converted").length,
    approximated: entries.filter((e) => e.status === "approximated").length,
    htmlFallback: entries.filter((e) => e.status === "html-fallback").length,
    skipped: entries.filter((e) => e.status === "skipped").length,
  };

  const report: ImportReport = { entries, warnings, summary };

  return { content, report };
}
