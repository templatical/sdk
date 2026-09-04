// The format registry. A new @templatical/import-* converter is ONE entry here
// and nothing else: SKILL.md documents the routing rule rather than the list,
// and `--list-formats` answers what is resolvable at runtime. That is what lets
// a new importer ship without a skill edit or a plugin version bump.

import { readFileSync } from "node:fs";
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
  /** Whether the converter takes parsed JSON or the raw text. */
  input: "json" | "text";
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
  html: {
    pkg: "@templatical/import-html",
    fn: "convertHtmlTemplate",
    input: "text",
  },
};

/** Guess the source format, or null when the caller must pass --format. */
export function detectFormat(fileName: string, content: string): string | null {
  const ext = extname(fileName).toLowerCase();
  if (ext === ".html" || ext === ".htm") return "html";
  const trimmed = content.trimStart();
  if (trimmed.startsWith("<")) return "html";
  if (trimmed.startsWith("{")) {
    let obj: { body?: { rows?: unknown }; page?: { rows?: unknown } };
    try {
      obj = JSON.parse(content);
    } catch {
      return null;
    }
    // Unlayer designs come from editor.saveDesign(): { body: { rows } }.
    if (obj?.body?.rows) return "unlayer";
    // BeeFree templates: { page: { rows } }.
    if (obj?.page?.rows) return "beefree";
    return null;
  }
  return null;
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
          `  ${f.format.padEnd(8)} ${f.package}${f.available ? "" : "  (not installed)"}`,
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
  const convert = mod[spec.fn] as (input: unknown) => {
    content: unknown;
    report: unknown;
  };
  const input = spec.input === "json" ? JSON.parse(source) : source;
  const { content, report } = convert(input);

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
