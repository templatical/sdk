// Import an existing Unlayer / BeeFree / HTML email template into Templatical
// template JSON, using the deterministic `@templatical/import-*` converters.
// Writes the result to the shared working file (.templatical/<name>.json) so it
// flows into validation + live mode exactly like a generated template.
//
// The converters are OPTIONAL and install-on-demand (like @templatical/quality):
// build mode stays ajv-only; importing a given format only needs that format's
// package. This script dynamically imports it and prints the exact `npm install`
// if it's missing.
//
// Import is lossy by design — unmapped constructs become `html` blocks or are
// skipped — so the printed report tells you what to refine (ideally in live mode).
//
// Usage:
//   node scripts/import.mjs <source-file> [--format unlayer|beefree|html] [--cwd .] [--out <name>]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FORMATS = {
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

/**
 * Guess the source format from the file name + content. Returns a FORMATS key,
 * or null when it can't tell (caller should ask for `--format`).
 */
export function detectFormat(fileName, content) {
  const ext = extname(fileName).toLowerCase();
  if (ext === ".html" || ext === ".htm") return "html";
  const trimmed = content.trimStart();
  if (trimmed.startsWith("<")) return "html";
  if (trimmed.startsWith("{")) {
    let obj;
    try {
      obj = JSON.parse(content);
    } catch {
      return null;
    }
    // Unlayer designs are the output of `editor.saveDesign()`: { body: { rows } }.
    if (obj?.body?.rows) return "unlayer";
    // BeeFree templates: { page: { rows } }.
    if (obj?.page?.rows) return "beefree";
    return null;
  }
  return null;
}

/**
 * Normalize an import report into status counts. Derived from `report.entries`
 * (each carries a `status`) so it's robust across all three converters rather
 * than depending on each package's `summary` shape.
 */
export function summarizeReport(report) {
  const counts = {
    total: 0,
    converted: 0,
    approximated: 0,
    htmlFallback: 0,
    skipped: 0,
  };
  for (const e of report?.entries ?? []) {
    counts.total++;
    if (e.status === "converted") counts.converted++;
    else if (e.status === "approximated") counts.approximated++;
    else if (e.status === "html-fallback") counts.htmlFallback++;
    else if (e.status === "skipped") counts.skipped++;
  }
  return { ...counts, warnings: report?.warnings ?? [] };
}

/**
 * Run the converter for `format` over `source` (the raw file contents). The
 * converter package is imported dynamically; a missing one throws an error with
 * `.missingPackage` set so callers can print an install hint / skip gracefully.
 * @returns {Promise<{ content: object, report: object }>}
 */
export async function runImport(source, format) {
  const spec = FORMATS[format];
  if (!spec) {
    throw new Error(
      `Unknown format "${format}". Use one of: ${Object.keys(FORMATS).join(", ")}.`,
    );
  }
  let mod;
  try {
    mod = await import(spec.pkg);
  } catch {
    const err = new Error(
      `This import needs ${spec.pkg}, which isn't installed. Install it in the skill folder:\n  npm install ${spec.pkg}`,
    );
    err.missingPackage = spec.pkg;
    throw err;
  }
  const convert = mod[spec.fn];
  const input = spec.input === "json" ? JSON.parse(source) : source;
  return convert(input);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") args.format = argv[++i];
    else if (a === "--cwd") args.cwd = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = resolve(args.cwd ?? process.cwd());
  const sourceArg = args._[0];
  if (!sourceArg) {
    console.error(
      "Usage: node scripts/import.mjs <source-file> [--format unlayer|beefree|html] [--out <name>]",
    );
    process.exit(2);
  }

  const sourcePath = isAbsolute(sourceArg)
    ? sourceArg
    : resolve(cwd, sourceArg);
  let source;
  try {
    source = readFileSync(sourcePath, "utf8");
  } catch (err) {
    console.error(`Could not read ${sourceArg}: ${err.message}`);
    process.exit(2);
  }

  const format = args.format ?? detectFormat(basename(sourcePath), source);
  if (!format || !FORMATS[format]) {
    console.error(
      `Couldn't detect the template format of ${sourceArg}. Pass --format unlayer|beefree|html.`,
    );
    process.exit(2);
  }

  let result;
  try {
    result = await runImport(source, format);
  } catch (err) {
    console.error(err.message);
    process.exit(err.missingPackage ? 2 : 1);
  }

  const outName = (args.out ?? basename(sourcePath, extname(sourcePath)))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const outPath = resolve(cwd, ".templatical", `${outName || "imported"}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify(result.content, null, 2)}\n`,
    "utf8",
  );

  const s = summarizeReport(result.report);
  console.log(`Imported ${sourceArg} (${format}) → ${outPath}`);
  console.log(
    `Blocks: ${s.total} total · ${s.converted} converted` +
      (s.approximated ? ` · ${s.approximated} approximated` : "") +
      (s.htmlFallback ? ` · ${s.htmlFallback} fell back to html` : "") +
      (s.skipped ? ` · ${s.skipped} skipped` : ""),
  );
  for (const w of s.warnings) console.log(`  ⚠ ${w}`);
  if (s.htmlFallback || s.skipped || s.warnings.length) {
    console.log(
      "Review the html-fallback / skipped blocks (they're the lossy bits) — validate, then refine in live mode.",
    );
  }
  console.log(`Next: node scripts/validate.mjs .templatical/${outName}.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
