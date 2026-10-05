import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { renderToMjml } from "@templatical/renderer";
import type { TemplateContent } from "@templatical/types";
import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import {
  EXIT,
  InvalidTemplateError,
  readTemplateFile,
  resolveFrom,
  UsageError,
} from "../io";
import { requireMjml } from "../mjml";
import { validateTemplate } from "../../index";

const FORMATS = new Set(["mjml", "html"]);

export async function runRender(args: ParsedArgs): Promise<number> {
  const file = args.positional[0];
  if (!file) throw new UsageError("render needs a template file.");

  const format = flagValue(args, "format") ?? "mjml";
  if (!FORMATS.has(format)) {
    throw new UsageError(`Unknown --format "${format}". Use mjml or html.`);
  }

  const cwd = flagValue(args, "cwd") ?? process.cwd();
  const data = readTemplateFile(file, cwd);

  // A structurally invalid template must fail with the error list (exit 1),
  // not surface as a renderer-internals crash (exit 2) — edit.ts validates
  // for the same reason before it writes.
  const { valid, errors } = validateTemplate(data);
  if (!valid) {
    throw new InvalidTemplateError(
      `${file} is not structurally valid (${errors.length} error(s)).`,
      errors,
    );
  }

  const content = data as TemplateContent;
  const mjml = await renderToMjml(content);

  let output = mjml;
  if (format === "html") {
    const compile = await requireMjml(cwd, "Rendering HTML");
    output = (await compile(mjml, { validationLevel: "soft" })).html;
  }

  const out = flagValue(args, "out", "o");
  if (out) {
    const path = resolveFrom(out, cwd);
    // render writes raw text, not JSON, so it can't reuse writeTemplateFile —
    // create the parent directory directly instead.
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, output, "utf8");
    note(`Wrote ${path}`);
    return EXIT.ok;
  }

  emit({ format, output }, () => output);
  return EXIT.ok;
}
