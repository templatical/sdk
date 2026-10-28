import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
describe("CLI strings documentation", () => {
  it.each([
    "apps/docs/guide/localized-templates.md",
    "apps/docs/de/guide/localized-templates.md",
    "apps/docs/backend/translation.md",
    "apps/docs/de/backend/translation.md",
    "apps/docs/api/types.md",
    "apps/docs/de/api/types.md",
    "skills/templatical/reference/localize.md",
  ])("%s keeps fields with incompatible old tags eligible", (file) => {
    const text = readFileSync(resolve(root, file), "utf8");
    expect(text).not.toMatch(
      /changed tags make a field ineligible|a changed tag makes the field ineligible|changed tags (?:exclude|skip) the field|geänderte Tags schließen (?:ein|das) Feld aus|stored translation missing a protected term is excluded|missing or changed protected term makes the field ineligible|fehlt darin[^.]*wird das Feld ausgeschlossen/,
    );
    expect(text).toMatch(/current default|aktuellen Standard/);
  });
  it("routes custom translations in the validate playbook through definitions", () => {
    const text = readFileSync(
      resolve(root, "skills/templatical/reference/validate.md"),
      "utf8",
    );
    expect(text).toContain("--definitions");
    expect(text).not.toContain("CLI has no custom definitions flag");
  });
  it.each([
    "apps/docs/api/template-tools.md",
    "apps/docs/de/api/template-tools.md",
    "skills/templatical/reference/cli.md",
  ])(
    "%s documents the file, options, rejections and partial success",
    (file) => {
      const text = readFileSync(resolve(root, file), "utf8");
      for (const contract of [
        "strings export",
        "strings import",
        "strings/1",
        "sourceLocale",
        "targetLocale",
        "sourceHash",
        "--only",
        "--block",
        "--syntax",
        "--definitions",
        "--do-not-translate",
        "unsafe_html",
        "tags_changed",
        "not_translatable",
        "unknown_field",
      ]) {
        expect(text, contract).toContain(contract);
      }
      expect(text).not.toMatch(
        /CLI has no flag for custom-block definitions|CLI hat kein Flag für (?:benutzerdefinierte|Custom-)Blockdefinitionen/,
      );
    },
  );
  it.each([
    "apps/docs/guide/localized-templates.md",
    "apps/docs/de/guide/localized-templates.md",
    "skills/templatical/reference/localize.md",
  ])("%s routes strings and custom translations to the CLI", (file) => {
    const text = readFileSync(resolve(root, file), "utf8");
    expect(text).toContain("strings export");
    expect(text).toContain("strings import");
    expect(text).toContain("--definitions");
    expect(text).not.toMatch(
      /no strings CLI|no strings export\/import CLI|keinen CLI-Befehl dafür|CLI (?:has no|cannot supply|cannot render|hat kein)/,
    );
  });
});
