import {
  createDefaultTemplateContent,
  DEFAULT_TEMPLATE_DEFAULTS,
} from "@templatical/types";
import type {
  Block,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";
import { parseColor, parsePx } from "./attribute-parser";
import {
  convertLeaf,
  isLoopType,
  markLoopApproximated,
  readLoopExpression,
  skippedLoopEntry,
  type MapContext,
} from "./block-mapper";
import { readStyle, styleValue } from "./normalize";
import { buildFullwidth } from "./section-builder";
import type {
  ChamaileonDocument,
  ChamaileonNode,
  ImportReportEntry,
  ImportResult,
} from "./types";

const INVALID_MESSAGE =
  "Invalid Chamaileon template: expected the document JSON object from getDocument().";
const WRONG_BODY_MESSAGE =
  'Invalid Chamaileon template: expected body.type to be "body".';
const EMPTY_WARNING =
  "No convertible content was found in the Chamaileon document. Check that body.children holds at least one fullwidth.";

/**
 * `DEFAULT_TEMPLATE_DEFAULTS` is typed `Partial<TemplateSettings>` so a
 * consumer can override any subset, but its own literal always sets the six
 * required fields. Narrowing once here is what lets each fallback come out as
 * `number`/`string`/`boolean` rather than `| undefined`.
 */
const REQUIRED_DEFAULTS = DEFAULT_TEMPLATE_DEFAULTS as Required<
  Pick<
    TemplateSettings,
    | "width"
    | "backgroundColor"
    | "textColor"
    | "linkUnderline"
    | "fontFamily"
    | "locale"
  >
>;

/**
 * Convert a Chamaileon `getDocument()` tree into a Templatical template.
 *
 * The input is the document object itself — `{ body, variables?, … }` —
 * not `getEmailHtml()` markup and not an API envelope. That is documented
 * rather than sniffed: guessing between the persist JSON and compiled HTML
 * would send the HTML through the wrong package.
 *
 * @example
 * ```ts
 * const document = await editorInstance.methods.getDocument();
 * const { content, report } = convertChamaileonTemplate(document);
 * ```
 */
export function convertChamaileonTemplate(
  doc: ChamaileonDocument | string,
): ImportResult {
  const root: unknown = typeof doc === "string" ? safeParse(doc) : doc;

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    throw new Error(INVALID_MESSAGE);
  }

  const document = root as ChamaileonDocument;
  const body = document.body;
  if (!body || body.type !== "body") {
    throw new Error(WRONG_BODY_MESSAGE);
  }

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];
  const stats = { resolvedVariables: 0 };
  const variables = document.variables ?? [];

  const bodyStyle = readStyle(body, variables, stats);
  const width =
    parsePx(styleValue(bodyStyle, "bodyWidth")) ?? REQUIRED_DEFAULTS.width;
  const backgroundColor =
    parseColor(styleValue(bodyStyle, "backgroundColor")) ??
    REQUIRED_DEFAULTS.backgroundColor;

  const previewRaw =
    typeof document.previewText === "string" ? document.previewText.trim() : "";
  const subjectRaw =
    typeof document.subjectLine === "string" ? document.subjectLine.trim() : "";
  if (subjectRaw) {
    warnings.push(
      `Dropped subjectLine ("${document.subjectLine}") — Templatical templates have no subject-line field.`,
    );
  }

  const fontFiles = document.fontFiles;
  if (
    fontFiles &&
    typeof fontFiles === "object" &&
    !Array.isArray(fontFiles) &&
    Object.keys(fontFiles).length > 0
  ) {
    warnings.push(
      "Dropped fontFiles — Templatical templates have no document-level font-file table.",
    );
  }

  const ctx: MapContext = {
    bodyWidth: width,
    columnWidth: width,
    variables,
    warnings,
    stats,
  };

  for (const child of body.children ?? []) {
    convertBodyChild(child, ctx, entries, blocks);
  }

  if (stats.resolvedVariables > 0) {
    warnings.push(
      `Resolved ${stats.resolvedVariables} colour/image variables to their default values.`,
    );
  }

  if (blocks.length === 0) {
    warnings.push(EMPTY_WARNING);
  }

  const defaults = createDefaultTemplateContent();
  const content: TemplateContent = {
    ...defaults,
    blocks,
    settings: {
      ...defaults.settings,
      width,
      backgroundColor,
      ...(previewRaw ? { preheaderText: previewRaw } : {}),
    },
  };

  const summary = {
    total: entries.length,
    converted: entries.filter((e) => e.status === "converted").length,
    approximated: entries.filter((e) => e.status === "approximated").length,
    htmlFallback: entries.filter((e) => e.status === "html-fallback").length,
    skipped: entries.filter((e) => e.status === "skipped").length,
  };

  return { content, report: { entries, warnings, summary } };
}

function convertBodyChild(
  node: ChamaileonNode,
  ctx: MapContext,
  entries: ImportReportEntry[],
  blocks: Block[],
): void {
  if (node.type === "fullwidth") {
    blocks.push(...buildFullwidth(node, ctx, entries));
    return;
  }
  if (isLoopType(node.type)) {
    convertLoop(node, ctx, entries, blocks);
    return;
  }
  const converted = convertLeaf(node, ctx);
  entries.push(converted.entry);
  if (converted.block) blocks.push(converted.block);
}

function convertLoop(
  node: ChamaileonNode,
  ctx: MapContext,
  entries: ImportReportEntry[],
  blocks: Block[],
): void {
  const type = node.type ?? "loop";
  const expression = readLoopExpression(node, ctx);
  const children = node.children ?? [];
  if (children.length === 0) {
    entries.push(skippedLoopEntry(type, expression));
    return;
  }
  const from = entries.length;
  for (const child of children) {
    convertBodyChild(child, ctx, entries, blocks);
  }
  markLoopApproximated(entries, from, type, expression);
}

function safeParse(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(INVALID_MESSAGE);
  }
}
