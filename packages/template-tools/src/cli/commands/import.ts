// The format registry. A new @templatical/import-* converter is ONE entry here
// and nothing else: reference/import.md documents the routing rule rather than
// the list, and `--list-formats` answers what is resolvable at runtime. That is
// what lets a new importer ship without a skill edit.

import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { flagValue, type ParsedArgs } from "../args";
import { emit } from "../output";
import {
  EXIT,
  MissingDependencyError,
  resolveFrom,
  UsageError,
  writeTemplateFile,
} from "../io";
import { resolveOptional } from "../resolve-optional";
import { WORKING_DIR } from "../../live/index";

interface FormatSpec {
  pkg: string;
  /** The converter's exported function name. */
  fn: string;
  /**
   * What the converter is handed. `json` parses the source first, `text` passes
   * it through, and `stripo` unpacks a `{ html, css }` envelope — Stripo is the
   * one format whose export may arrive as either shape.
   */
  input: "json" | "text" | "stripo";
}

export const FORMATS: Record<string, FormatSpec> = {
  unlayer: {
    pkg: "@templatical/import-unlayer",
    fn: "convertUnlayerTemplate",
    input: "json",
  },
  beefree: {
    pkg: "@templatical/import-beefree",
    fn: "convertBeeFreeTemplate",
    input: "json",
  },
  stripo: {
    pkg: "@templatical/import-stripo",
    fn: "convertStripoTemplate",
    input: "stripo",
  },
  topol: {
    pkg: "@templatical/import-topol",
    fn: "convertTopolTemplate",
    input: "json",
  },
  chamaileon: {
    pkg: "@templatical/import-chamaileon",
    fn: "convertChamaileonTemplate",
    input: "json",
  },
  "easy-email-pro": {
    pkg: "@templatical/import-easy-email-pro",
    fn: "convertEasyEmailProTemplate",
    input: "json",
  },
  mjml: {
    pkg: "@templatical/import-mjml",
    fn: "convertMjmlTemplate",
    input: "text",
  },
  html: {
    pkg: "@templatical/import-html",
    fn: "convertHtmlTemplate",
    input: "text",
  },
};

/** Strip a tag and its contents, so class scanning never reads CSS or script. */
function withoutElements(html: string, tag: string): string {
  const open = `<${tag}`;
  const close = `</${tag}`;
  const lower = html.toLowerCase();
  let out = "";
  let pos = 0;
  while (pos < html.length) {
    const start = lower.indexOf(open, pos);
    if (start === -1) {
      out += html.slice(pos);
      break;
    }
    const next = lower[start + open.length];
    // `<style` matches `<styles>` too unless the next char ends the tag name.
    if (next !== undefined && /[a-z0-9-]/.test(next)) {
      out += html.slice(pos, start + open.length);
      pos = start + open.length;
      continue;
    }
    out += html.slice(pos, start);
    const gt = html.indexOf(">", start);
    if (gt === -1) break;
    const closeAt = lower.indexOf(close, gt + 1);
    if (closeAt === -1) break;
    const closeGt = html.indexOf(">", closeAt);
    if (closeGt === -1) break;
    out += " ";
    pos = closeGt + 1;
  }
  return out;
}

/** Every class token in the markup, ignoring <style> and <script> contents. */
function markupClassTokens(html: string): string[] {
  const stripped = withoutElements(withoutElements(html, "style"), "script");
  const tokens: string[] = [];
  const re = /\bclass\s*=\s*(["'])([^"']*)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    tokens.push(...m[2].trim().split(/\s+/).filter(Boolean));
  }
  return tokens;
}

/** Stripo's own class prefixes, which survive both of its export shapes. */
function looksLikeStripoHtml(html: unknown): boolean {
  if (typeof html !== "string" || html.trim().length === 0) return false;
  const tokens = markupClassTokens(html);
  if (
    tokens.some(
      (t) =>
        t === "esd-stripe" ||
        t === "esd-structure" ||
        t === "esd-container-frame" ||
        t.startsWith("esd-block-"),
    )
  ) {
    return true;
  }
  return tokens.some(
    (t) =>
      t === "es-wrapper" || t === "es-content-body" || t === "es-header-body",
  );
}

/** Easy Email Pro marks its own nodes `standard-*`; OSS Easy Email does not. */
function hasStandardType(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: unknown; children?: unknown };
  if (typeof n.type === "string" && n.type.startsWith("standard-")) return true;
  if (Array.isArray(n.children)) return n.children.some(hasStandardType);
  return false;
}

/** Guess the source format, or null when the caller must pass --format. */
export function detectFormat(fileName: string, content: string): string | null {
  const ext = extname(fileName).toLowerCase();
  const trimmed = content.trimStart();

  // MJML is decided before both the extension check and the generic `<` branch:
  // an MJML document saved as .html is still MJML, and reading it as HTML
  // silently produces a table-soup import that looks like a bad converter.
  if (ext === ".mjml") return "mjml";
  if (/^<(\?xml[^>]*\?>\s*)?<?\s*mjml[\s>]/i.test(trimmed)) return "mjml";
  if (/^<\s*mj-body[\s>]/i.test(trimmed)) return "mjml";

  // Stripo's compiled File→HTML and its plugin storage are both `.html` (or a
  // JSON `{ html, css }` blob), so the class check must run before the generic
  // html branch or every Stripo export imports as table soup.
  if (looksLikeStripoHtml(content)) return "stripo";

  if (ext === ".html" || ext === ".htm") return "html";
  if (trimmed.startsWith("<")) return "html";
  if (trimmed.startsWith("{")) {
    let obj: {
      body?: { rows?: unknown; type?: unknown };
      page?: { rows?: unknown };
      tagName?: unknown;
      content?: { type?: unknown };
      type?: unknown;
      html?: unknown;
    };
    try {
      obj = JSON.parse(content);
    } catch {
      return null;
    }
    // Unlayer designs come from editor.saveDesign(): { body: { rows } }.
    if (obj?.body?.rows) return "unlayer";
    // BeeFree templates: { page: { rows } }.
    if (obj?.page?.rows) return "beefree";
    // Topol designs are an MJML-shaped tree rooted at the global style.
    if (obj?.tagName === "mj-global-style") return "topol";
    // Chamaileon getDocument(): { body: { type: "body" } }. Unlayer's
    // { body: { rows } } is matched above, so the order between them matters.
    if (obj?.body?.type === "body") return "chamaileon";
    // Easy Email Pro persist: { content: { type: "page" } } or a bare page,
    // distinguished from OSS Easy Email by its `standard-*` node types.
    const page =
      obj?.content?.type === "page"
        ? obj.content
        : obj?.type === "page"
          ? obj
          : null;
    if (page && hasStandardType(page)) return "easy-email-pro";
    // A plugin host often persists the whole getTemplateData() object.
    if (typeof obj?.html === "string" && looksLikeStripoHtml(obj.html)) {
      return "stripo";
    }
    return null;
  }
  return null;
}

/** Split a Stripo source into html + css, whichever shape it arrived in. */
export function unpackStripoSource(source: string): {
  html: string;
  css?: string;
} {
  const trimmed = source.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(source) as { html?: unknown; css?: unknown };
      if (typeof obj?.html === "string") {
        return {
          html: obj.html,
          css: typeof obj.css === "string" ? obj.css : undefined,
        };
      }
    } catch {
      // Not an envelope after all — treat the whole thing as markup.
    }
  }
  return { html: source };
}

/** The stylesheet a plugin host wrote beside an HTML export, if there is one. */
function siblingCss(sourcePath: string, source: string): string | undefined {
  // A JSON envelope carries its own css; only a bare .html file has a sibling.
  if (source.trimStart().startsWith("{")) return undefined;
  const cssPath = sourcePath.replace(/\.[^.]+$/, ".css");
  if (cssPath === sourcePath || !existsSync(cssPath)) return undefined;
  return readFileSync(cssPath, "utf8");
}

export interface ReportCounts {
  total: number;
  converted: number;
  approximated: number;
  htmlFallback: number;
  skipped: number;
  warnings: string[];
}

/**
 * Status counts from a converter's report. Derived from `report.entries` (every
 * entry carries a `status`) rather than each package's own `summary` shape, so
 * it works identically across all three converters and any future one.
 */
export function summarizeReport(report: unknown): ReportCounts {
  const r = report as
    { entries?: Array<{ status?: string }>; warnings?: string[] } | undefined;
  const counts: ReportCounts = {
    total: 0,
    converted: 0,
    approximated: 0,
    htmlFallback: 0,
    skipped: 0,
    warnings: r?.warnings ?? [],
  };
  for (const e of r?.entries ?? []) {
    counts.total++;
    if (e.status === "converted") counts.converted++;
    else if (e.status === "approximated") counts.approximated++;
    else if (e.status === "html-fallback") counts.htmlFallback++;
    else if (e.status === "skipped") counts.skipped++;
  }
  return counts;
}

async function listFormats(cwd: string): Promise<number> {
  const formats: Array<{
    format: string;
    package: string;
    available: boolean;
  }> = [];
  for (const [format, spec] of Object.entries(FORMATS)) {
    formats.push({
      format,
      package: spec.pkg,
      available: (await resolveOptional(spec.pkg, cwd)) !== null,
    });
  }
  emit({ formats }, () =>
    formats
      .map(
        (f) =>
          `  ${f.format.padEnd(14)} ${f.package}${f.available ? "" : "  (not installed)"}`,
      )
      .join("\n"),
  );
  return EXIT.ok;
}

export async function runImport(args: ParsedArgs): Promise<number> {
  const cwd = flagValue(args, "cwd") ?? process.cwd();
  if (args.flags["list-formats"]) return listFormats(cwd);

  const file = args.positional[0];
  if (!file) throw new UsageError("import needs a source file.");
  const path = resolveFrom(file, cwd);

  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(`Could not read ${file}`);
  }

  const known = Object.keys(FORMATS).join(", ");
  const requested = flagValue(args, "format");
  if (requested && !FORMATS[requested]) {
    throw new UsageError(
      `Unknown --format "${requested}". Known formats: ${known}.`,
    );
  }
  const format = requested ?? detectFormat(path, source);
  if (!format) {
    throw new UsageError(
      `Could not detect the format of ${file}. Pass --format with one of: ${known}.`,
    );
  }

  const spec = FORMATS[format];
  const mod = await resolveOptional<Record<string, unknown>>(spec.pkg, cwd);
  if (!mod) {
    throw new MissingDependencyError(
      spec.pkg,
      `Importing ${format} needs ${spec.pkg}, which isn't installed.\n  npm install ${spec.pkg}`,
    );
  }
  const convert = mod[spec.fn] as (
    input: unknown,
    options?: unknown,
  ) => {
    content: unknown;
    report: unknown;
  };

  let content: unknown;
  let report: unknown;
  if (spec.input === "stripo") {
    // Plugin storage keeps the stylesheet out of the markup — either beside the
    // html in one JSON envelope, or as a sibling .css file the host wrote next
    // to it. Without the CSS every block imports unstyled, which reads as a
    // broken converter rather than a missing file.
    const unpacked = unpackStripoSource(source);
    const css = unpacked.css ?? siblingCss(path, source);
    ({ content, report } = convert(unpacked.html, css ? { css } : undefined));
  } else {
    const input = spec.input === "json" ? JSON.parse(source) : source;
    ({ content, report } = convert(input));
  }

  const outName = flagValue(args, "out") ?? basename(path, extname(path));
  const written = writeTemplateFile(
    `${WORKING_DIR}/${outName}.json`,
    content,
    cwd,
  );

  const counts = summarizeReport(report);
  const lossy = counts.htmlFallback + counts.skipped > 0;
  emit({ format, file: written, report: counts }, () =>
    [
      `Imported ${format} to ${written}`,
      `  ${counts.converted} converted, ${counts.approximated} approximated, ${counts.htmlFallback} html fallback, ${counts.skipped} skipped`,
      ...counts.warnings.map((w) => `  ! ${w}`),
      lossy
        ? "  Import is lossy. Open it in live mode and refine the fallback blocks."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return EXIT.ok;
}
