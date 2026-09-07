import { createDefaultTemplateContent } from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import { readGlobalStyle } from "./global-style";
import { buildSection } from "./section-builder";
import type { MapContext } from "./block-mapper";
import type {
  ImportReport,
  ImportReportEntry,
  ImportResult,
  TopolDesign,
} from "./types";

const ROOT_TAG = "mj-global-style";

const EMPTY_DESIGN_WARNING =
  "No convertible content was found in the Topol design. Check that the mj-container holds at least one mj-section.";

/**
 * Convert a Topol.io design into a Templatical template.
 *
 * The input is the design object itself — the node whose `tagName` is
 * `mj-global-style`. Topol's REST API wraps it as `{ id, name, html, json }`,
 * so a caller passes `.json`. That is documented rather than sniffed: guessing
 * between an envelope and a design risks importing the envelope's `html`,
 * which belongs to a different package entirely.
 *
 * @example
 * ```ts
 * const { content, report } = convertTopolTemplate(design);
 * const editor = init({ container: '#editor', content });
 * console.log(report.summary);
 * ```
 */
export function convertTopolTemplate(
  design: TopolDesign | string,
): ImportResult {
  const root: unknown = typeof design === "string" ? safeParse(design) : design;

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    throw new Error(
      "Invalid Topol template: expected the design JSON object. If you fetched it from Topol's API, pass the response's \"json\" field.",
    );
  }

  if ((root as TopolDesign).tagName !== ROOT_TAG) {
    throw new Error(
      `Invalid Topol template: expected a root node with tagName "${ROOT_TAG}".`,
    );
  }

  const topolDesign = root as TopolDesign;
  const container = (topolDesign.children ?? []).find(
    (child) => child.tagName === "mj-container",
  );

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  const style = readGlobalStyle(topolDesign, container, warnings);

  const ctx: MapContext = {
    style,
    columnWidth: style.settings.width,
    warnings,
  };

  for (const child of container?.children ?? []) {
    if (child.tagName !== "mj-section") continue;
    blocks.push(...buildSection(child, ctx, entries));
  }

  if (blocks.length === 0) {
    warnings.push(EMPTY_DESIGN_WARNING);
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings: style.settings,
  };

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

function safeParse(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(
      "Invalid Topol template: expected the design JSON object. If you fetched it from Topol's API, pass the response's \"json\" field.",
    );
  }
}
