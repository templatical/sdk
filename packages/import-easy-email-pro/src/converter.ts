import {
  createDefaultTemplateContent,
  createSectionBlock,
  DEFAULT_TEMPLATE_DEFAULTS,
} from "@templatical/types";
import type {
  Block,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";
import { parseColor, parsePx } from "./attribute-parser";
import { convertLeaf, isLeafType, type MapContext } from "./block-mapper";
import {
  contextFromPage,
  isUnset,
  readAttr,
  unwrapDocument,
  withWidgetInput,
} from "./normalize";
import { buildTopLevel } from "./section-builder";
import type {
  EasyEmailProDocument,
  EasyEmailProNode,
  EasyEmailProPage,
  EasyEmailProTextNode,
  ImportReportEntry,
  ImportResult,
} from "./types";

const INVALID_MESSAGE =
  "Invalid Easy Email Pro template: expected a page JSON object (EmailTemplate { subject, content } or the page element).";
const OSS_MESSAGE =
  "Invalid Easy Email Pro template: this looks like open-source Easy Email JSON, not Easy Email Pro (expected standard-* children).";
const EMPTY_WARNING =
  "No convertible content was found in the Easy Email Pro page. Check that page.children holds at least one standard-section.";
const MOBILE_WARNING =
  "mobileAttributes were dropped; Templatical has no per-viewport padding.";

const OSS_CHILD_TYPES = new Set([
  "section",
  "column",
  "text",
  "button",
  "image",
  "wrapper",
  "hero",
  "navbar",
  "social",
]);

const STRUCTURE_TYPES = new Set([
  "standard-section",
  "standard-wrapper",
  "standard-hero",
]);

const WIDGET_TYPES = new Set(["section_widget", "wrapper_widget"]);

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
 * Convert an Easy Email Pro page (or EmailTemplate envelope) into a
 * Templatical template. Accepts a bare `page` element, an
 * `EmailTemplate { subject, content }` envelope, or a JSON string of either.
 */
export function convertEasyEmailProTemplate(
  doc: EasyEmailProDocument | EasyEmailProPage | string,
): ImportResult {
  const root: unknown = typeof doc === "string" ? safeParse(doc) : doc;

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    throw new Error(INVALID_MESSAGE);
  }

  const unwrapped = unwrapDocument(root);
  if (unwrapped.page.type !== "page") {
    throw new Error(INVALID_MESSAGE);
  }
  const page = unwrapped.page as EasyEmailProPage;
  const subject = unwrapped.subject;
  assertNotOss(page);

  const warnings: string[] = [];
  const entries: ImportReportEntry[] = [];
  const blocks: Block[] = [];
  const resolve = contextFromPage(page);
  const map: MapContext = { resolve, warnings };
  const data = isPlainObject(page.data) ? page.data : {};

  const subjectRaw = typeof subject === "string" ? subject.trim() : "";
  if (subjectRaw) {
    warnings.push(
      `Document subject "${subject}" has no TemplateSettings field and was dropped.`,
    );
  }
  if (Array.isArray(data.fonts) && data.fonts.length > 0) {
    warnings.push(
      "Dropped fonts[] — Templatical templates have no document-level font table.",
    );
  }
  if (isNonEmptyHeadStyles(data.headStyles)) {
    warnings.push(
      "Dropped headStyles — Templatical templates have no document-level head-style table.",
    );
  }
  if (
    isPlainObject(data.classAttributes) &&
    Object.keys(data.classAttributes).length > 0
  ) {
    warnings.push(
      "Dropped classAttributes — class-based MJML attribute cascade is not applied.",
    );
  }

  for (const child of page.children ?? []) {
    if (!isElement(child)) continue;
    walkNode(child, map, entries, blocks);
  }

  if (hasMobileAttributes(page)) {
    warnings.push(MOBILE_WARNING);
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
      ...readSettings(page, data, resolve),
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

function readSettings(
  page: EasyEmailProPage,
  data: Record<string, unknown>,
  resolve: MapContext["resolve"],
): TemplateSettings {
  const width =
    parsePx(readAttr(page, "width", resolve)) ?? REQUIRED_DEFAULTS.width;
  // Page `background-color` is the viewport band. `content-background-color`
  // is the section fill fallback (section-builder), never a settings field.
  const backgroundColor =
    parseColor(readAttr(page, "background-color", resolve)) ??
    REQUIRED_DEFAULTS.backgroundColor;
  const fontFamilyRaw = readAttr(page, "font-family", resolve);
  const fontFamily =
    typeof fontFamilyRaw === "string" && !isUnset(fontFamilyRaw)
      ? fontFamilyRaw
      : REQUIRED_DEFAULTS.fontFamily;
  const textColor =
    parseColor(readAttr(page, "color", resolve)) ?? REQUIRED_DEFAULTS.textColor;
  const linkColor = parseColor(readAttr(page, "link-color", resolve));
  const deco = readAttr(page, "link-text-decoration", resolve);
  const linkUnderline =
    deco === "underline"
      ? true
      : deco === "none"
        ? false
        : REQUIRED_DEFAULTS.linkUnderline;
  const preheaderRaw =
    typeof data.preheader === "string" ? data.preheader.trim() : "";

  return {
    width,
    backgroundColor,
    textColor,
    fontFamily,
    linkUnderline,
    locale: REQUIRED_DEFAULTS.locale,
    ...(linkColor ? { linkColor } : {}),
    ...(preheaderRaw ? { preheaderText: preheaderRaw } : {}),
  };
}

function walkNode(
  node: EasyEmailProNode,
  map: MapContext,
  entries: ImportReportEntry[],
  blocks: Block[],
): void {
  if (node.type === "placeholder") return;

  const logic = node.logic;
  const logicOn = hasLogic(logic);
  if (logicOn && !hasTypedContent(node)) {
    entries.push({
      sourceTag: node.type ?? "logic",
      templaticalBlockType: null,
      status: "skipped",
      note: `Skipped empty logic (${logicExpression(logic)})`,
    });
    return;
  }

  if (typeof node.type === "string" && WIDGET_TYPES.has(node.type)) {
    const from = entries.length;
    const data = isPlainObject(node.data) ? node.data : {};
    const input = isPlainObject(data.input) ? data.input : undefined;
    const inner: MapContext = {
      resolve: withWidgetInput(map.resolve, input),
      warnings: map.warnings,
    };
    for (const child of node.children ?? []) {
      if (!isElement(child)) continue;
      walkNode(child, inner, entries, blocks);
    }
    markApproximated(
      entries,
      from,
      `${node.type} flattened; $var resolved from data.input`,
      {
        sourceTag: node.type,
      },
    );
    if (logicOn) {
      markApproximated(entries, from, `logic ${logicExpression(logic)}`);
    }
    return;
  }

  const from = entries.length;
  if (typeof node.type === "string" && STRUCTURE_TYPES.has(node.type)) {
    const converted = buildTopLevel(node, map);
    for (const block of converted.blocks) blocks.push(block);
    for (const entry of converted.entries) entries.push(entry);
  } else {
    const converted = convertLeaf(node, map);
    for (const entry of converted.entries) entries.push(entry);
    if (converted.blocks.length > 0) {
      if (isLeafType(node.type)) {
        blocks.push(wrapInSection(converted.blocks));
      } else {
        blocks.push(...converted.blocks);
      }
    }
  }

  if (logicOn) {
    markApproximated(entries, from, `logic ${logicExpression(logic)}`);
  }
}

function wrapInSection(blocks: Block[]): Block {
  const section = createSectionBlock();
  section.columns = "1";
  section.children = [blocks];
  return section;
}

function markApproximated(
  entries: ImportReportEntry[],
  from: number,
  extra: string,
  rewrite?: { sourceTag: string },
): void {
  for (let i = from; i < entries.length; i++) {
    const entry = entries[i];
    if (rewrite) entry.sourceTag = rewrite.sourceTag;
    if (entry.status === "converted") entry.status = "approximated";
    entry.note = entry.note ? `${entry.note} ${extra}` : extra;
  }
}

function hasLogic(
  logic: EasyEmailProNode["logic"],
): logic is NonNullable<EasyEmailProNode["logic"]> {
  if (logic == null || typeof logic !== "object") return false;
  return logic.condition != null || logic.iteration != null;
}

function logicExpression(
  logic: NonNullable<EasyEmailProNode["logic"]>,
): string {
  const parts: string[] = [];
  if (logic.condition != null) {
    parts.push(
      typeof logic.condition === "string"
        ? logic.condition
        : JSON.stringify(logic.condition),
    );
  }
  if (logic.iteration != null) {
    const iteration = logic.iteration;
    if (typeof iteration === "string") {
      parts.push(iteration);
    } else if (
      isPlainObject(iteration) &&
      typeof iteration.dataSource === "string"
    ) {
      parts.push(iteration.dataSource);
    } else {
      parts.push(JSON.stringify(iteration));
    }
  }
  return parts.join(" ");
}

function hasTypedContent(node: EasyEmailProNode): boolean {
  for (const child of node.children ?? []) {
    if (!isElement(child)) continue;
    if (child.type === "placeholder") continue;
    return true;
  }
  return false;
}

function hasMobileAttributes(node: unknown): boolean {
  if (!isPlainObject(node)) return false;
  const mobile = node.mobileAttributes;
  if (isPlainObject(mobile) && Object.keys(mobile).length > 0) return true;
  if (!Array.isArray(node.children)) return false;
  for (const child of node.children) {
    if (hasMobileAttributes(child)) return true;
  }
  return false;
}

function assertNotOss(page: EasyEmailProPage): void {
  const children = page.children ?? [];
  for (const child of children) {
    if (!child || typeof child !== "object") continue;
    const type = (child as EasyEmailProNode).type;
    if (typeof type !== "string") continue;
    if (OSS_CHILD_TYPES.has(type)) {
      throw new Error(OSS_MESSAGE);
    }
    break;
  }
}

function isElement(
  node: EasyEmailProNode | EasyEmailProTextNode,
): node is EasyEmailProNode {
  return typeof node.type === "string" && node.type !== "";
}

function isNonEmptyHeadStyles(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(INVALID_MESSAGE);
  }
}
