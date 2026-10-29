import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const plain = (file: string) =>
  readFileSync(join(ROOT, file), "utf8")
    .replace(/[`*]/g, "")
    .replace(/\s+/g, " ");

describe("localized template documentation contracts", () => {
  it.each([
    ["apps/docs/guide/localized-templates.md", false],
    ["apps/docs/de/guide/localized-templates.md", true],
    ["apps/docs/api/template-tools.md", false],
    ["apps/docs/de/api/template-tools.md", true],
    ["skills/templatical/reference/localize.md", false],
    ["skills/templatical/reference/validate.md", false],
  ] as const)(
    "%s pins locale exits and the unknown-locale diagnostic",
    (file, german) => {
      const source = plain(file);
      expect(source).toMatch(
        german
          ? /unbekannte Locales? (?:ergibt|ergeben) Exit 1[^.]*unknown_locale[^.]*stderr[^.]*(?:ohne|kein) Ergebnisdokument/i
          : /unknown locales? exits? 1[^.]*unknown_locale[^.]*stderr[^.]*(?:without a|no) result document/i,
      );
      expect(source).toMatch(
        german
          ? /(?:leerer oder fehlender|fehlender oder leerer|Fehlende\/leere) --locale[^.]*Exit 2/i
          : /(?:missing or empty|empty or missing|missing\/empty) --locale[^.]*exits? 2/i,
      );
      expect(source).not.toMatch(
        german
          ? /unbekannte Locales? (?:ergibt|ergeben) Exit 2/i
          : /unknown locales? exits? 2/i,
      );
    },
  );

  it.each([
    ["apps/docs/guide/localized-templates.md", false],
    ["apps/docs/de/guide/localized-templates.md", true],
    ["skills/templatical/reference/localize.md", false],
  ] as const)(
    "%s distinguishes field and block Reset scope",
    (file, german) => {
      const source = plain(file);
      expect(source).toMatch(
        german
          ? /Werkzeugleiste zeigt eine Sprachmarkierung[^.]*Auf \{default\} zurücksetzen[^.]*erhält benachbarte Überschreibungen/
          : /toolbar shows a language pill[^.]*Reset to \{default\}[^.]*(?:keeps|preserves) sibling overrides/,
      );
      expect(source).toMatch(
        german
          ? /Änderungen zurücksetzen im Chip entfernt alle set-Überschreibungen dieses Blocks[^.]*text-Übersetzungen bleiben erhalten/
          : /(?:block )?chip[’']s Reset changes clears all of that block[’']s set overrides[^.]*keeps[^.]*text translations/,
      );
    },
  );

  it.each([
    ["apps/docs/api/template-tools.md", false],
    ["apps/docs/de/api/template-tools.md", true],
    ["skills/templatical/reference/validate.md", false],
  ] as const)("%s documents lint tool failures", (file, german) => {
    const source = plain(file);
    expect(source).toMatch(
      german ? /Ausnahme im Qualitäts-Linter/ : /exception inside quality lint/,
    );
    expect(source).toMatch(
      german
        ? /Tool-Fehler \(2, 3\)[^.]*ohne Ergebnisdokument/
        : /tool errors \(2, 3\)[^.]*without a result document/i,
    );
  });

  it.each(["", "de/"])(
    "%sheadless usage keeps compatibility on its scanner path",
    (prefix) => {
      const source = plain(`apps/docs/${prefix}quality/headless-usage.md`);
      const helper = source.match(/runRules[^.]+/)?.[0];
      expect(helper).toBeDefined();
      expect(helper).toContain("lintLocalization");
      expect(helper).not.toContain("lintCompatibility");
      expect(source).toMatch(/lintCompatibility[^.]*scanBlock[^.]*lintScan/);
    },
  );
});
