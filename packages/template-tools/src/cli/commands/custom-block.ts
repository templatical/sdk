import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import {
  EXIT,
  InvalidTemplateError,
  readTemplateFile,
  resolveFrom,
  UsageError,
} from "../io";
import { loadMjml, requireMjml } from "../mjml";
import {
  buildSpecimen,
  buildSpecimenTemplate,
  checkCustomBlock,
  checkRecipe,
  renderSpecimenMjml,
  runRecipe,
  SPECIMEN_STATES,
  validateCustomBlockDefinition,
  type CustomBlockIssue,
  type CustomBlockWorkingFile,
  type SpecimenState,
} from "../../custom-block";

const USAGE =
  "Use `custom-block validate <file>`, `custom-block render <file>` or `custom-block fetch <file>`.";

function formatIssues(issues: CustomBlockIssue[]): string {
  return issues
    .map(
      (i) =>
        `  - [${i.severity}] ${i.ruleId}${i.path ? ` ${i.path}` : ""}: ${i.message}`,
    )
    .join("\n");
}

function loadValid(file: string, cwd: string): CustomBlockWorkingFile {
  const data = readTemplateFile(file, cwd);
  const r = validateCustomBlockDefinition(data);
  if (!r.valid) {
    throw new InvalidTemplateError(
      `${file} is not a valid custom block definition.`,
      r.issues.filter((i) => i.severity === "error").map((i) => i.message),
    );
  }
  return data as CustomBlockWorkingFile;
}

export async function runCustomBlock(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  const file = args.positional[1];
  if (sub !== "validate" && sub !== "render" && sub !== "fetch") {
    throw new UsageError(`Unknown "custom-block ${sub ?? ""}". ${USAGE}`);
  }
  if (!file)
    throw new UsageError(`custom-block ${sub} needs a definition file.`);
  const cwd = flagValue(args, "cwd") ?? process.cwd();

  if (sub === "validate") {
    const mjml = await loadMjml(cwd);
    const result = await checkCustomBlock(readTemplateFile(file, cwd), {
      compileMjml: mjml
        ? async (m) => ({
            errors: (await mjml(m, { validationLevel: "soft" })).errors,
          })
        : undefined,
    });
    if (!mjml)
      note("`mjml` isn't installed, so the HTML compile check was skipped.");
    emit(result, () =>
      result.issues.length === 0
        ? "✓ Valid custom block — no issues"
        : `${result.valid ? "✓ Valid" : "✗ Invalid"} · ${result.issues.length} issue(s):\n${formatIssues(result.issues)}`,
    );
    return result.valid ? EXIT.ok : EXIT.invalid;
  }

  const def = loadValid(file, cwd);

  if (sub === "render") {
    const state = flagValue(args, "state");
    if (
      state !== undefined &&
      !(SPECIMEN_STATES as readonly string[]).includes(state)
    ) {
      throw new UsageError(
        `Unknown --state "${state}". Use one of: ${SPECIMEN_STATES.join(", ")}.`,
      );
    }
    const format = flagValue(args, "format") ?? "mjml";
    if (format !== "mjml" && format !== "html")
      throw new UsageError(`Unknown --format "${format}". Use mjml or html.`);
    let output = await renderSpecimenMjml(
      def,
      buildSpecimenTemplate(def, undefined, state as SpecimenState | undefined),
    );
    if (format === "html")
      output = (
        await (
          await requireMjml(cwd, "Rendering HTML")
        )(output, { validationLevel: "soft" })
      ).html;
    const out = flagValue(args, "out", "o");
    if (out) {
      const path = resolveFrom(out, cwd);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, output, "utf8");
      note(`Wrote ${path}`);
      return EXIT.ok;
    }
    emit({ format, output }, () => output);
    return EXIT.ok;
  }

  // sub === "fetch"
  if (!def.dataSourcePreview)
    throw new UsageError(`${file} has no \`dataSourcePreview\` to run.`);
  const recipeErrors = checkRecipe(def).filter((i) => i.severity === "error");
  if (recipeErrors.length > 0) {
    throw new InvalidTemplateError(
      `${file} has a dataSourcePreview the bridge would refuse to run.`,
      recipeErrors.map((i) => `${i.ruleId}: ${i.message}`),
    );
  }
  const raw = flagValue(args, "values");
  let overrides: Record<string, unknown> = {};
  if (raw !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new UsageError("--values must be a JSON object.");
    }
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new UsageError("--values must be a JSON object.");
    }
    overrides = parsed as Record<string, unknown>;
  }
  const defaults = buildSpecimen(def)[0].fieldValues;
  const result = await runRecipe(def.dataSourcePreview, {
    ...defaults,
    ...overrides,
  });
  emit(result, () =>
    result.ok
      ? `✓ ${result.status} · ${JSON.stringify(result.values, null, 2)}${result.unmapped.length ? `\nUnmapped: ${result.unmapped.join(", ")}` : ""}`
      : `✗ ${result.error}`,
  );
  return result.ok ? EXIT.ok : EXIT.invalid;
}
