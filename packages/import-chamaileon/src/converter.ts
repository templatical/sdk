import { createDefaultTemplateContent } from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import type {
  ChamaileonDocument,
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

  if (blocks.length === 0) {
    warnings.push(EMPTY_WARNING);
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
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

function safeParse(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(INVALID_MESSAGE);
  }
}
