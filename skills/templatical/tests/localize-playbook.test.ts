import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("localization agent path", () => {
  it("routes translation file exchange through the existing strings CLI in its eval", () => {
    const data = JSON.parse(read("evals/evals.json"));
    const entry = data.evals.find((entry: { id: number }) => entry.id === 30);
    expect(entry.expected_output).toContain("template-tools strings export");
    expect(entry.expected_output).toContain("template-tools strings import");
    expect(entry.expected_output).toContain("placeholders unchanged");
    expect(entry.expected_output).toContain("rejected");
    expect(entry.expected_output).not.toContain("invent a strings CLI");
  });
  it("keeps protected-term fields eligible in the brand-protection eval", () => {
    const data = JSON.parse(read("evals/evals.json"));
    const entry = data.evals.find((entry: { id: number }) => entry.id === 31);
    expect(entry.expected_output).not.toContain(
      "stored translations missing a protected term are excluded",
    );
    expect(entry.expected_output).toContain("current default");
  });
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

  it("routes each localization job to its docs page", () => {
    const source = read("reference/localize.md");
    for (const page of [
      "guide/localized-templates",
      "backend/translation",
      "api/operations",
      "api/template-tools",
      "api/types",
    ])
      expect.soft(source, page).toContain(page);
    for (const term of [
      "setDefaultLocale",
      "defaultLocaleGaps",
      "localeHiddenBlocks",
      "strings export",
      "strings import",
      "doNotTranslate",
      "providers.md",
      "maskTags",
      "unmaskTags",
      "the old default keeps no copy of them",
      "before the change",
      "`locked_by_others`",
      "unless that hash equals the promoted value",
      "setting each entry's `text`",
      "shows an icon whose tooltip and accessible name give the label",
      "don't send HTML blocks or empty defaults",
    ])
      expect.soft(source, term).toContain(term);
    expect(source).not.toContain("translate them in the new default");
    expect(source).not.toContain("keep their current or out-of-date state");
  });

  it("gives the CLI, edit and authoring playbooks the language commands", () => {
    const cli = read("reference/cli.md");
    expect(cli).toContain("--default-locale");
    expect(cli).toContain('"op":"setDefaultLocale"');
    const edit = read("reference/edit.md");
    expect(edit).toContain(
      `edit .templatical/<name>.json --op '{"op":"setDefaultLocale","locale":"de"}' --json`,
    );
    expect(edit).toContain("localeHiddenBlocks");
    expect(edit).toContain("the old default keeps no copy of them");
    expect(edit).toContain("translate HTML blocks by hand");
    const rules = read("reference/rules.md");
    expect(rules).toMatch(/ids? must not contain `\.` or `\/`/);
    expect(rules).toContain("setDefaultLocale");
  });

  it.each([
    [
      32,
      "default language",
      [
        "localize.md",
        "edit.md",
        "setDefaultLocale",
        "defaultLocaleGaps",
        "localeHiddenBlocks",
        "Make default language",
        "invalid_operation",
        "validate --locale en",
        "one undo step",
        "before the change",
        "keeps no copy",
        "locked_by_others",
        "translated from exactly the promoted German text",
        "settings.locales contains en",
      ],
    ],
    [
      33,
      "template-tools",
      [
        "cli.md",
        "localize.md",
        "strings export",
        "strings import",
        "--do-not-translate",
        "sourceHash",
        "placeholders unchanged",
        "rejected",
        "exit 1",
        "validate --locale de",
      ],
    ],
  ] as const)(
    "eval %i covers its language job end to end",
    (id, prompt, terms) => {
      const data = JSON.parse(read("evals/evals.json"));
      const entry = data.evals.find((entry: { id: number }) => entry.id === id);
      expect(entry).toBeDefined();
      expect(entry.prompt).toContain(prompt);
      for (const term of terms)
        expect.soft(entry.expected_output, term).toContain(term);
    },
  );

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
