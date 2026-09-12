import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import { EXIT, readTemplateFile, UsageError } from "../io";
import { runQualityLint, validateTemplate } from "../../index";

export function runValidate(args: ParsedArgs): number {
  const file = args.positional[0];
  if (!file) throw new UsageError("validate needs a template file.");
  const cwd = flagValue(args, "cwd") ?? process.cwd();

  const data = readTemplateFile(file, cwd);
  const { valid, errors } = validateTemplate(data);

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
  const quality = runQualityLint(data);
  if (quality.error) {
    note(`Quality lint could not run: ${quality.error}`);
  }

  const issues = quality.issues;
  const blocking = issues.filter((i) => i.severity === "error");

  emit({ valid: true, errors: [], issues }, () => {
    if (issues.length === 0) return "✓ Valid — no quality issues";
    const lines = issues.map(
      (i) => `  - [${i.severity}] ${i.ruleId}: ${i.message}`,
    );
    return [
      `✓ Structurally valid · ${issues.length} quality issue(s):`,
      ...lines,
    ].join("\n");
  });

  // A severity-"error" issue is a real defect, not advice, so it fails the
  // command — matching the script this replaces. Warnings and info do not.
  return blocking.length > 0 ? EXIT.invalid : EXIT.ok;
}
