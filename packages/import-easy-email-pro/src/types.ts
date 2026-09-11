export type ConversionStatus =
  "converted" | "approximated" | "html-fallback" | "skipped";

export interface ImportReportEntry {
  /** The source Easy Email Pro `type` string (e.g. "standard-button"). */
  sourceTag: string;
  templaticalBlockType: string | null;
  status: ConversionStatus;
  note?: string;
}

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

export interface ImportResult {
  content: import("@templatical/types").TemplateContent;
  report: ImportReport;
}

export interface EasyEmailProVariable {
  name?: string;
  value?: unknown;
  type?: string;
  label?: string;
}

export interface EasyEmailProNode {
  type?: string;
  data?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  mobileAttributes?: Record<string, unknown>;
  visible?: "desktop" | "mobile" | string;
  logic?: { condition?: unknown; iteration?: unknown };
  children?: Array<EasyEmailProNode | EasyEmailProTextNode>;
  title?: string;
  name?: string;
  uid?: string;
  [key: string]: unknown;
}

export interface EasyEmailProTextNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  bgColor?: string;
  link?: { href?: string; blank?: boolean } | null;
  [key: string]: unknown;
}

export type EasyEmailProPage = EasyEmailProNode & { type: "page" };

export interface EasyEmailProDocument {
  subject?: string;
  content?: EasyEmailProPage | EasyEmailProNode;
  html?: unknown;
  mjml?: unknown;
  thumbnail?: unknown;
  id?: unknown;
  [key: string]: unknown;
}
