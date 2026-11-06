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

function resolveColumnLayout(
  cells: number[],
  warnings: string[],
): ColumnLayout {
  if (cells.length <= 1) return "1";
  if (cells.length === 4) {
    // Layout "4" is four equal quarters, so unequal cells lose their ratio.
    if (cells.some((cell) => cell !== cells[0])) {
      warnings.push(
        `Row with four columns at ratio ${cells.join(":")} was converted to four equal columns.`,
      );
    }
    return "4";
  }

  if (cells.length > 4) {
    warnings.push(
      `Row with ${cells.length} columns was flattened to a single column. Unlayer supports arbitrary columns, but Templatical supports up to four columns.`,
    );
    return "1";
  }

  if (cells.length === 2) {
    const left = cells[0] ?? 1;
    const right = cells[1] ?? 1;
    const total = left + right;
    const ratio = left / total;

    // 0.71 / 0.29 sit just past the midpoint of 2/3 and 3/4, so 7/10 stays 2-1.
    if (ratio > 0.71) return "3-1";
    if (ratio > 0.58) return "2-1";
    if (ratio < 0.29) return "1-3";
    if (ratio < 0.42) return "1-2";
    return "2";
  }

  const total = cells.reduce((sum, cell) => sum + cell, 0);
  if (total <= 0) return "3";
  const shares = cells.map((cell) => cell / total);
  const distance = (target: readonly number[]) =>
    shares.reduce(
      (sum, share, index) => sum + Math.abs(share - (target[index] ?? 0)),
      0,
    );
  // "3" wins a tie: an equal distance stays on the even split.
  if (distance([0.25, 0.5, 0.25]) < distance([1 / 3, 1 / 3, 1 / 3])) {
    return "1-2-1";
  }
  return "3";
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

  const padding = parsePaddingShorthand(row.values?.padding);
  const paint = resolveRowPaint(row, settings.width, warnings);

  const section = createSectionBlock({
    columns: layout,
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
