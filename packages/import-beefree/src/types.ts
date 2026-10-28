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
  computedStyle?: Record<string, string | boolean>;
  text?: BeeFreeeTextContent;
  paragraph?: BeeFreeeTextContent;
  heading?: BeeFreeeHeadingContent;
  list?: BeeFreeeTextContent;
  image?: BeeFreeeImageContent;
  button?: BeeFreeeButtonContent;
  divider?: BeeFreeeeDividerContent;
  spacer?: BeeFreeeSpacerContent;
  html?: BeeFreeeHtmlContent;
  iconsList?: BeeFreeeSocialContent;
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

export interface BeeFreeeSocialIcon {
  image?: {
    title?: string;
    src?: string;
    href?: string;
    alt?: string;
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
}
