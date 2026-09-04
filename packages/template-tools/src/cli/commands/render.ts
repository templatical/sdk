import { writeFileSync } from "node:fs";
import { renderToMjml } from "@templatical/renderer";
import type { TemplateContent } from "@templatical/types";
import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import {
  EXIT,
  MissingDependencyError,
  readTemplateFile,
  resolveFrom,
  UsageError,
} from "../io";
import { resolveOptional } from "../resolve-optional";

// The mjml npm package's own top-level function (lib/index.js) is declared
// `async`, so it always returns a Promise even though mjml-core's underlying
// compile is synchronous — calling it without awaiting silently hands back a
// pending Promise instead of { html, errors }.
type Mjml2Html = (
  mjml: string,
  options?: Record<string, unknown>,
) => Promise<{ html: string; errors: unknown[] }>;

const FORMATS = new Set(["mjml", "html"]);

export async function runRender(args: ParsedArgs): Promise<number> {
  const file = args.positional[0];
  if (!file) throw new UsageError("render needs a template file.");

  const format = flagValue(args, "format") ?? "mjml";
  if (!FORMATS.has(format)) {
    throw new UsageError(`Unknown --format "${format}". Use mjml or html.`);
  }

  const cwd = flagValue(args, "cwd") ?? process.cwd();
  const content = readTemplateFile(file, cwd) as TemplateContent;
  const mjml = await renderToMjml(content);

  let output = mjml;
  if (format === "html") {
    // The SDK bundles no MJML compiler by design, so there is no fallback to
    // reach for: a missing peer is a hard stop with an actionable message.
    const mod = await resolveOptional<{ default: Mjml2Html }>("mjml", cwd);
    if (!mod) {
      throw new MissingDependencyError(
        "mjml",
        "Rendering HTML needs the optional `mjml` package, which isn't installed.\n  npm install mjml",
      );
    }
    output = (await mod.default(mjml, { validationLevel: "soft" })).html;
  }

  const out = flagValue(args, "out", "o");
  if (out) {
    const path = resolveFrom(out, cwd);
    writeFileSync(path, output, "utf8");
    note(`Wrote ${path}`);
    return EXIT.ok;
  }

  emit({ format, output }, () => output);
  return EXIT.ok;
}
