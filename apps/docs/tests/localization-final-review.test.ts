import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const root = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const pattern = "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$";

describe("localization public contracts", () => {
  it.each(["types", "ai-kit"])(
    "discloses required producers in the %s changeset",
    (pkg) => {
      const text = read(
        pkg === "types"
          ? ".changeset/localized-templates-types.md"
          : ".changeset/translation-ai-kit.md",
      );
      for (const term of [
        "AiRequestBase.locale",
        "AiRewriteRequest.locale",
        "CollaborationRemoteChange.locale",
        "required",
        "null",
        "must set",
        "existing templates need no migration",
      ])
        expect.soft(text).toContain(term);
      expect(text).toContain(`"@templatical/${pkg}": minor`);
    },
  );
  it.each(["", "de/"])("%s collaboration links reach compatibility", (lang) => {
    const text = read(`apps/docs/${lang}backend/collaboration.md`);
    expect(text).toContain("localized-templates#compatibility");
    expect(text).not.toContain("localized-templates#upgrading");
  });
  it.each([
    "apps/docs/guide/localized-templates.md",
    "apps/docs/de/guide/localized-templates.md",
    "skills/templatical/reference/localize.md",
  ])("%s states the exact language-tag pattern", (path) => {
    const text = read(path);
    for (const term of [pattern, "x-…", "i-…", "no-bok", "zh-min-nan"])
      expect.soft(text).toContain(term);
    expect(text).not.toMatch(
      /grandfathered.*(?:rejected|aren't accepted)|historische Tags.*nicht akzeptiert/,
    );
  });
  it.each([
    ["", ["language versions", "Translate"]],
    ["de/", ["Sprachversionen", "übersetzen"]],
  ])(
    "%s guide description contains the lookup terms in one sentence",
    (lang, words) => {
      const description =
        read(`apps/docs/${lang}guide/localized-templates.md`).match(
          /^description: (.+)$/m,
        )?.[1] ?? "";
      for (const term of [
        "settings.locales",
        "l10n",
        "resolveLocale",
        "--locale",
        "TranslationProvider",
        ...words,
      ])
        expect.soft(description).toContain(term);
      expect(
        description
          .replaceAll("settings.locales", "settings_locales")
          .match(/[.!?]/g),
      ).toHaveLength(1);
    },
  );
});

it.each(["", "de/"])(
  "%s types reference includes value-aware structural checking",
  (lang) => {
    expect(read(`apps/docs/${lang}api/types.md`)).toContain(
      "isStructuralLocalePath(block: Block, path: string, value?: unknown): boolean",
    );
  },
);

it("the shared localization snippet includes the replacement-value parameter", () => {
  const snippet = read("apps/docs/snippets/localization-contract.ts");
  expect(snippet).toMatch(
    /function isStructuralLocalePath\(\s*block: Block,\s*path: string,\s*value\?: unknown,?\s*\): boolean/,
  );
});
