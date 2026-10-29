import {
  defaultLocaleOption,
  localeTag,
  registerLocales,
  set,
  warn,
} from "./localization";
import {
  createSectionBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type {
  BackgroundImage,
  Block,
  ColumnLayout,
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
} from "./block-mapper";
import type { ContentContext } from "./block-mapper";
import {
  parsePxValue,
  parseColor,
  parseFontFamily,
  parsePaddingShorthand,
  readUnlayerBackgroundImage,
} from "./style-parser";

function resolveColumnLayout(
  cells: number[],
  warnings: string[],
): ColumnLayout {
  if (cells.length <= 1) return "1";
  if (cells.length === 3) return "3";

  if (cells.length === 2) {
    const left = cells[0] ?? 1;
    const right = cells[1] ?? 1;
    const total = left + right;
    const ratio = left / total;

    if (ratio > 0.58) return "2-1";
    if (ratio < 0.42) return "1-2";
    return "2";
  }

  warnings.push(
    `Row with ${cells.length} columns was flattened to a single column. Unlayer supports arbitrary columns, but Templatical supports up to 3.`,
  );
  return "1";
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
  "1-2": [1 / 3, 2 / 3],
  "2-1": [2 / 3, 1 / 3],
};

/**
 * A column's px width as the renderer draws it: the body width times the
 * column's share, rounded down. A column past the layout's last slot takes
 * the whole body width, the renderer's fallback.
 */
function columnWidthAt(
  layout: ColumnLayout,
  bodyWidth: number,
  index: number,
): number {
  return Math.floor(bodyWidth * (COLUMN_SHARES[layout][index] ?? 1));
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
    const { block, entry } = convertContent(content, warnings, context);
    blocks.push(block);
    entries.push(entry);
  }

  return blocks;
}

/**
 * The section's fill. `columnsBackgroundColor` covers the content width, the
 * area a section paints; `backgroundColor` is the band outside it, used only
 * when the row sets no content colour.
 */
function resolveRowBackground(
  row: UnlayerRow,
  warnings: string[],
): string | undefined {
  const content = parseColor(row.values?.columnsBackgroundColor);
  const band = parseColor(row.values?.backgroundColor);
  if (content && band && content !== band) {
    warnings.push(
      `Row background ${band} outside the content width was dropped; the section keeps the content background ${content}.`,
    );
  }
  return content || band || undefined;
}

/**
 * The image a row's section paints. `fullWidth: false` is the content area
 * a section paints, so it maps exactly. A full-width band (Unlayer's
 * default) shows through the content area only while
 * `columnsBackgroundColor` leaves it transparent: then the section paints it
 * at the content width, and otherwise it's dropped. Losses go to `warnings`,
 * since rows have no report entry.
 */
function resolveRowBackgroundImage(
  row: UnlayerRow,
  width: number,
  warnings: string[],
): BackgroundImage | undefined {
  const bg = row.values?.backgroundImage;
  const read = readUnlayerBackgroundImage(bg, "Row", width);
  if (!read) return undefined;

  const band = bg?.fullWidth !== false;
  const content = parseColor(row.values?.columnsBackgroundColor);
  if (band && content) {
    warnings.push(
      `Row background image "${read.image.url}" outside the content width was dropped; the section keeps the content background ${content}.`,
    );
    return undefined;
  }

  warnings.push(...read.notes);
  if (band) {
    warnings.push(
      `Row background image "${read.image.url}" spans the full width in Unlayer; the section paints it at the content width.`,
    );
  }
  return read.image;
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
  const layout = resolveColumnLayout(cells, warnings);
  const contextAt = (index: number): ContentContext => ({
    columnWidth: columnWidthAt(layout, settings.width, index),
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

  const background = resolveRowBackground(row, warnings);
  const padding = parsePaddingShorthand(row.values?.padding);
  const backgroundImage = resolveRowBackgroundImage(
    row,
    settings.width,
    warnings,
  );

  const section = createSectionBlock({
    columns: layout,
    children,
    styles: {
      padding,
      ...(background ? { backgroundColor: background } : {}),
    },
    ...(backgroundImage ? { backgroundImage } : {}),
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
      if (
        typeof backgroundImage.url === "string" &&
        backgroundImage.url.trim() === ""
      ) {
        set(section, locale, "backgroundImage", null);
      } else {
        const image = resolveRowBackgroundImage(
          { ...row, values: { ...row.values, ...values, backgroundImage } },
          settings.width,
          warnings,
        );
        if (image) set(section, locale, "backgroundImage", image);
        else if (typeof backgroundImage.url !== "string")
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
