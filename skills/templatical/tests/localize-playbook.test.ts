import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("localization agent path", () => {
  it("describes only the rendered result notice fields", () => {
    const source = read("reference/localize.md");
    const notice = source.match(
      /Read the dismissible result notice:[^\n]*/,
    )?.[0];
    expect(notice).toBeDefined();
    expect(notice).not.toContain("cancellation");
  });

  it.each(["integrate", "scaffold", "diagnose", "providers"])(
    "%s routes Translate setup and failures to its contract and conformance",
    (name) => {
      const source = read(`reference/${name}.md`);
      for (const term of [
        "translation",
        "Translate",
        "localize.md",
        "backend/translation",
        "mask",
        "runTranslationConformance",
      ])
        expect.soft(source, term).toContain(term);
    },
  );

  it("teaches translation with gaps, exact tokens and validation", () => {
    const source = read("reference/localize.md");
    for (const term of [
      "TranslationProvider",
      "gaps",
      "maskTags",
      "applyLocaleStrings",
      "__xn__",
      "tags_changed",
      "translation_running",
      "backend/translation",
      "runTranslationConformance",
      "localization.untranslated",
      "localization.stale",
      "localization.merge-tags-differ",
    ])
      expect.soft(source, term).toContain(term);
    expect(source).toMatch(/^## Limits/m);
  });

  it("has a translation eval requiring backend conformance and locale validation", () => {
    const data = JSON.parse(read("evals/evals.json"));
    const entry = data.evals.find((entry: { prompt: string }) =>
      entry.prompt.includes("translation provider"),
    );
    expect(entry).toBeDefined();
    for (const term of [
      "TranslationProvider",
      "mask",
      "gaps",
      "validate --locale de",
      "backend/translation",
      "runTranslationConformance",
    ])
      expect(entry.expected_output).toContain(term);
  });
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
