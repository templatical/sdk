/**
 * Unlayer JSON type definitions.
 * Based on the design JSON shape produced by `editor.saveDesign()` in
 * react-email-editor / Unlayer's hosted editor.
 */

export interface UnlayerTemplate {
  counters?: Record<string, number>;
  body: UnlayerBody;
  schemaVersion?: number;
}

export interface UnlayerBody {
  id?: string;
  rows: UnlayerRow[];
  headers?: UnlayerRow[];
  footers?: UnlayerRow[];
  values: UnlayerBodyValues;
}

export interface UnlayerBackgroundImage {
  url?: string;
  fullWidth?: boolean;
  repeat?: string;
  size?: string;
  position?: string;
}

export interface UnlayerFontFamily {
  label?: string;
  value?: string;
}

export interface UnlayerBodyValues {
  backgroundColor?: string;
  backgroundImage?: UnlayerBackgroundImage;
  contentWidth?: string;
  contentAlignment?: string;
  fontFamily?: UnlayerFontFamily;
  textColor?: string;
  linkStyle?: Record<string, string>;
  preheaderText?: string;
  [key: string]: unknown;
}

export interface UnlayerRow {
  id?: string;
  cells: number[];
  columns: UnlayerColumn[];
  values: UnlayerRowValues;
}

export interface UnlayerRowValues {
  backgroundColor?: string;
  backgroundImage?: UnlayerBackgroundImage;
  padding?: string;
  columnsBackgroundColor?: string;
  hideMobile?: boolean;
  hideDesktop?: boolean;
  noStackMobile?: boolean;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UnlayerColumn {
  id?: string;
  contents: UnlayerContent[];
  values: UnlayerColumnValues;
}

export interface UnlayerColumnValues {
  backgroundColor?: string;
  padding?: string;
  border?: Record<string, string>;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UnlayerContent {
  type: string;
  values: UnlayerContentValues;
}

export interface UnlayerLinkAction {
  name?: string;
  values?: { href?: string; target?: string };
}

export interface UnlayerImageSrc {
  url?: string;
  width?: number;
  height?: number;
}

export interface UnlayerButtonColors {
  color?: string;
  backgroundColor?: string;
  hoverColor?: string;
  hoverBackgroundColor?: string;
}

export interface UnlayerBorder {
  borderTopWidth?: string;
  borderTopStyle?: string;
  borderTopColor?: string;
}

export interface UnlayerMenuItem {
  key?: string;
  text: string;
  link?: UnlayerLinkAction;
}

export interface UnlayerMenu {
  items: UnlayerMenuItem[];
}

export interface UnlayerSocialIcon {
  name?: string;
  url?: string;
  type?: string;
}

export interface UnlayerSocialIcons {
  iconType?: string;
  editor?: { data?: { showTitle?: boolean } };
  icons?: UnlayerSocialIcon[];
}

export interface UnlayerContentValues {
  // shared
  containerPadding?: string;
  textAlign?: string;
  fontFamily?: UnlayerFontFamily;
  fontSize?: string;
  fontWeight?: string | number;
  color?: string;
  hideMobile?: boolean;
  hideDesktop?: boolean;
  // text / heading
  text?: string;
  headingType?: string;
  // image
  src?: UnlayerImageSrc;
  altText?: string;
  action?: UnlayerLinkAction;
  // button
  buttonColors?: UnlayerButtonColors;
  borderRadius?: string;
  padding?: string;
  size?: { autoWidth?: boolean; width?: string };
  href?: UnlayerLinkAction;
  // divider
  border?: UnlayerBorder;
  width?: string;
  // html
  html?: string;
  // menu
  menu?: UnlayerMenu;
  layout?: "horizontal" | "vertical";
  separator?: string;
  // social
  icons?: UnlayerSocialIcons;
  // video
  videoUrl?: string;
  thumbnailUrl?: string;
  [key: string]: unknown;
}

/**
 * Conversion status for each content node in the import report.
 */
export type ConversionStatus =
  | "converted"
  | "approximated"
  | "html-fallback"
  | "skipped";

/**
 * A single entry in the import report.
 */
export interface ImportReportEntry {
  unlayerContentType: string;
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
 * The result of an Unlayer import operation.
 */
export interface ImportResult {
  content: import("@templatical/types").TemplateContent;
  report: ImportReport;
}
