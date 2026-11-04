export type BeeFreeTranslations = Record<string, Record<string, unknown>>;

/**
 * BeeFree JSON type definitions.
 * Based on the BeeFree export format used by the BEE Plugin / BEE Pro editor.
 */

export interface BeeFreeTemplate {
  head?: { meta?: { preheader?: string; translations?: BeeFreeTranslations } };
  language?: { label?: string; value: string };
  page: BeeFreeePage;
  comments?: Record<string, unknown>;
}

export interface BeeFreeePage {
  language?: { label?: string; value: string };
  title?: string;
  description?: string;
  rows: BeeFreeeRow[];
  body?: BeeFreeeBody;
}

export interface BeeFreeeBody {
  language?: { label?: string; value: string };
  type?: string;
  webFonts?: BeeFreeeWebFont[];
  content?: {
    style?: Record<string, string>;
    computedStyle?: Record<string, string>;
  };
  container?: {
    style?: Record<string, string>;
  };
}

export interface BeeFreeeWebFont {
  name: string;
  fontFamily?: string;
  url?: string;
}

export interface BeeFreeeRow {
  uuid?: string;
  type?: string;
  locked?: boolean;
  synced?: boolean;
  empty?: boolean;
  columns: BeeFreeeColumn[];
  container?: {
    style?: Record<string, string>;
  };
  content?: {
    style?: Record<string, string>;
    computedStyle?: Record<string, string | boolean>;
  };
}

export interface BeeFreeeColumn {
  uuid?: string;
  "grid-columns"?: number;
  style?: Record<string, string>;
  modules: BeeFreeeModule[];
}

export interface BeeFreeeModule {
  translations?: BeeFreeTranslations;
  type: string;
  locked?: boolean;
  uuid?: string;
  descriptor: BeeFreeeModuleDescriptor;
}

export interface BeeFreeeModuleDescriptor {
  style?: Record<string, string>;
  /**
   * Values BeeFree computed for the module. Numbers appear in older exports
   * (`width: 187.5`), and the Icons module nests objects (`iconSpacing`), so
   * every reader checks the type it needs.
   */
  computedStyle?: Record<string, unknown>;
  text?: BeeFreeeTextContent;
  paragraph?: BeeFreeeTextContent;
  heading?: BeeFreeeHeadingContent;
  list?: BeeFreeeTextContent;
  image?: BeeFreeeImageContent;
  button?: BeeFreeeButtonContent;
  divider?: BeeFreeeeDividerContent;
  spacer?: BeeFreeeSpacerContent;
  html?: BeeFreeeHtmlContent;
  /** Social icons for the Social module, icon items for the Icons module. */
  iconsList?: BeeFreeeSocialContent | BeeFreeeIconsContent;
  video?: BeeFreeeVideoContent;
  menu?: BeeFreeeMenuContent;
  table?: BeeFreeeTableContent;
}

export interface BeeFreeeTextContent {
  translations?: BeeFreeTranslations;
  style?: Record<string, string>;
  computedStyle?: Record<string, string>;
  html: string;
}

export interface BeeFreeeHeadingContent {
  translations?: BeeFreeTranslations;
  title?: string;
  text?: string;
  style?: Record<string, string>;
}

export interface BeeFreeeImageContent {
  translations?: BeeFreeTranslations;
  src: string;
  href?: string;
  /**
   * Written by the GIPHY addon: the GIF's page on giphy.com, not a link the
   * author set. The importer links an image from `href` only.
   */
  url?: string;
  alt?: string;
  width?: string;
  height?: string;
  prefix?: string;
  style?: Record<string, string>;
}

export interface BeeFreeeButtonContent {
  translations?: BeeFreeTranslations;
  label: string;
  href?: string;
  style?: Record<string, string>;
}

export interface BeeFreeeeDividerContent {
  style?: Record<string, string>;
}

export interface BeeFreeeSpacerContent {
  style?: Record<string, string>;
}

export interface BeeFreeeHtmlContent {
  html: string;
}

export interface BeeFreeeSocialContent {
  icons: BeeFreeeSocialIcon[];
}

export interface BeeFreeeIconsContent {
  icons: BeeFreeeIconItem[];
}

/** An item of the Icons module (`mailup-bee-newsletter-modules-icons`). */
export interface BeeFreeeIconItem {
  /** The icon's image URL. */
  image?: string;
  alt?: string;
  title?: string;
  href?: string;
  target?: string;
  text?: string;
  textPosition?: string;
  /** The image file's own size, e.g. `"48px"`. */
  width?: string;
  height?: string;
}

export interface BeeFreeeSocialIcon {
  image?: {
    title?: string;
    src?: string;
    href?: string;
    alt?: string;
    target?: string;
    /** The icon file's size. A number of px, or a px length. */
    width?: string | number;
    height?: string | number;
  };
  name?: string;
  text?: string;
  type?: string;
  id?: string;
}

export interface BeeFreeeVideoContent {
  thumbAlt?: string;
  translations?: BeeFreeTranslations;
  src: string;
  thumbnail?: string;
  alt?: string;
  style?: Record<string, string>;
}

export interface BeeFreeeMenuContent {
  translations?: BeeFreeTranslations;
  items: BeeFreeeMenuItem[];
  separator?: string;
  separatorColor?: string;
  style?: Record<string, string>;
}

export interface BeeFreeeMenuItem {
  text: string;
  link?: string;
  href?: string;
  target?: string;
}

export interface BeeFreeeTableContent {
  rows: BeeFreeeTableRow[];
  hasHeaderRow?: boolean;
  headerBackgroundColor?: string;
  cellPadding?: number | string;
  style?: Record<string, string>;
}

export interface BeeFreeeTableRow {
  cells: BeeFreeeTableCell[];
}

export interface BeeFreeeTableCell {
  content?: string;
  html?: string;
}

/**
 * Conversion status for each module in the import report.
 */
export type ConversionStatus =
  "converted" | "approximated" | "html-fallback" | "skipped";

/**
 * A single entry in the import report.
 */
export interface ImportReportEntry {
  beeFreeModuleType: string;
  templaticalBlockType: string | null;
  status: ConversionStatus;
  note?: string;
}

/**
 * The full import report returned alongside the converted template.
 */
export interface ImportReport {
  entries: ImportReportEntry[];
  warnings: string[];
  summary: {
    total: number;
    converted: number;
    approximated: number;
    htmlFallback: number;
    skipped: number;
  };
}

/**
 * The result of a BeeFree import operation.
 */
export interface ImportResult {
  content: import("@templatical/types").TemplateContent;
  report: ImportReport;
  /**
   * Web fonts to load, taken from `page.body.webFonts` entries that carry a
   * URL. A host passes them to the editor's `fonts.customFonts` and to
   * `render`. System stacks and `inherit` are left out.
   */
  customFonts: import("@templatical/types").CustomFont[];
}
