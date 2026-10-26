import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("localization agent path", () => {
  it.each([
    "SKILL.md",
    ...["integrate", "scaffold", "diagnose", "edit"].map(
      (name) => `reference/${name}.md`,
    ),
  ])("%s routes language versions to the playbook", (path) => {
    expect(read(path)).toContain("localize.md");
  });

  it("provides the compatibility, authoring, validation and rendering contract", () => {
    const source = read("reference/localize.md");
    for (const term of [
      "need no migration",
      "one version",
      "addLocale",
      "updateBlockLocale",
      "updateSettingsLocale",
      "sourceHash",
      "validate",
      "--locale de",
      "render",
      "Not enabled",
      "read-only",
      "lock",
    ])
      expect(source).toContain(term);
  });

  it("has a localization eval covering disabled versions and collaboration", () => {
    const data = JSON.parse(read("evals/evals.json"));
    const entry = data.evals.find((entry: { prompt: string }) =>
      entry.prompt.includes("localization.locales"),
    );
    expect(entry).toBeDefined();
    for (const term of [
      "no migration",
      "one version",
      "validate --locale",
      "read-only",
      "locale",
    ]) {
      expect(entry.expected_output).toContain(term);
    }
  });
});
