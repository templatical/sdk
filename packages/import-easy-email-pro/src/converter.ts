import { createDefaultTemplateContent } from "@templatical/types";
import type {
  EasyEmailProDocument,
  EasyEmailProNode,
  EasyEmailProPage,
  ImportReportEntry,
  ImportResult,
} from "./types";

const INVALID_MESSAGE =
  "Invalid Easy Email Pro template: expected a page JSON object (EmailTemplate { subject, content } or the page element).";
const OSS_MESSAGE =
  "Invalid Easy Email Pro template: this looks like open-source Easy Email JSON, not Easy Email Pro (expected standard-* children).";
const EMPTY_WARNING =
  "No convertible content was found in the Easy Email Pro page. Check that page.children holds at least one standard-section.";

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

  const { page, subject } = resolvePage(
    root as EasyEmailProDocument | EasyEmailProPage,
  );
  assertNotOss(page);

  const warnings: string[] = [];
  const entries: ImportReportEntry[] = [];

  const subjectRaw = typeof subject === "string" ? subject.trim() : "";
  if (subjectRaw) {
    warnings.push(
      `Document subject "${subject}" has no TemplateSettings field and was dropped.`,
    );
  }

  // Stub: do not walk children yet.
  warnings.push(EMPTY_WARNING);

  const content = createDefaultTemplateContent();
  const summary = {
    total: entries.length,
    converted: 0,
    approximated: 0,
    htmlFallback: 0,
    skipped: 0,
  };

  return { content, report: { entries, warnings, summary } };
}

function resolvePage(root: EasyEmailProDocument | EasyEmailProPage): {
  page: EasyEmailProPage;
  subject: unknown;
} {
  if (root.type === "page") {
    return { page: root as EasyEmailProPage, subject: undefined };
  }

  const content = (root as EasyEmailProDocument).content;
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    (content as EasyEmailProNode).type === "page"
  ) {
    return {
      page: content as EasyEmailProPage,
      subject: (root as EasyEmailProDocument).subject,
    };
  }

  throw new Error(INVALID_MESSAGE);
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

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(INVALID_MESSAGE);
  }
}
