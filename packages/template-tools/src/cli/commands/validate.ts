import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import { EXIT, readTemplateFile, UsageError } from "../io";
import { runQualityLint, validateTemplate } from "../../index";
import { renderToMjml } from "@templatical/renderer";
import { lintCompiledHtml } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";
import { requireMjml } from "../mjml";
import { customBlockRenderOptions, readDefinitions } from "../definitions";

export async function runValidate(args: ParsedArgs): Promise<number> {
  const file = args.positional[0];
  if (!file) throw new UsageError("validate needs a template file.");
  const locale = flagValue(args, "locale");
  if (args.flags.locale !== undefined && !locale?.trim()) {
    throw new UsageError("--locale needs a language tag.");
  }
  const cwd = flagValue(args, "cwd") ?? process.cwd();
  const definitions = readDefinitions(args, cwd);
  const compile =
    args.flags.html === true
      ? await requireMjml(cwd, "Validating HTML size")
      : null;

  const data = readTemplateFile(file, cwd);
  const { valid, errors } = validateTemplate(data, definitions);

  if (!valid) {
    emit({ valid: false, errors, issues: [] }, () =>
      [
        `✗ Structural validation failed (${errors.length}):`,
        ...errors.map((e) => `  - ${e}`),
      ].join("\n"),
    );
    return EXIT.invalid;
  }

  // The linter assumes a structurally-valid template, so it runs only here.
  const quality = runQualityLint(data, {
    contentLocale: locale,
    customBlocks: definitions,
  });
  if (quality.error !== undefined) {
    note(`Quality lint could not run: ${quality.error}`);
    return EXIT.usage;
  }

  const issues = [...quality.issues];
  let htmlBytes: number | undefined;
  if (compile) {
    const mjml = await renderToMjml(data as TemplateContent, {
      locale,
      ...customBlockRenderOptions(definitions),
    });
    const html = (await compile(mjml, { validationLevel: "soft" })).html;
    htmlBytes = new TextEncoder().encode(html).byteLength;
    issues.push(...lintCompiledHtml(html));
  }
  const blocking = issues.filter((i) => i.severity === "error");

  emit(
    {
      valid: true,
      errors: [],
      issues,
      ...(htmlBytes !== undefined ? { htmlBytes } : {}),
    },
    () => {
      if (issues.length === 0) return "✓ Valid — no quality issues";
      const lines = issues.flatMap((i) => [
        `  - [${i.severity}] ${i.ruleId}: ${i.message}`,
        `    → ${i.suggestion}`,
      ]);
      return [
        `✓ Structurally valid · ${issues.length} quality issue(s):`,
        ...lines,
      ].join("\n");
    },
  );

  // A severity-"error" issue is a real defect, not advice, so it fails the
  // command — matching the script this replaces. Merge-tag mismatches also
  // fail validation; other warnings and info remain advisory.
  if (issues.some((i) => i.ruleId === "localization.merge-tags-differ")) {
    return EXIT.invalid;
  }
  return blocking.length > 0 ? EXIT.invalid : EXIT.ok;
}
