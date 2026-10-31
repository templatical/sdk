import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT } from "../src/cli/io";

const read = (rel: string) =>
  readFileSync(join(import.meta.dirname, "../../..", rel), "utf8");

describe("documented validate exit-code contract", () => {
  it.each([
    ["skills/templatical/reference/validate.md", false],
    ["apps/docs/api/template-tools.md", false],
    ["apps/docs/de/api/template-tools.md", true],
  ] as const)("%s matches EXIT and the error-severity rule", (rel, german) => {
    expect(EXIT).toEqual({ ok: 0, invalid: 1, usage: 2, missingDep: 3 });
    const command = read(
      "packages/template-tools/src/cli/commands/validate.ts",
    );
    expect(command).toContain('issues.filter((i) => i.severity === "error")');
    expect(command).toContain(
      "return blocking.length > 0 ? EXIT.invalid : EXIT.ok;",
    );
    const src = read(rel);
    const rows = [...src.matchAll(/^\| `(\d)` \| ([^|]+)/gm)].map(
      (m) => [Number(m[1]), m[2].trim()] as const,
    );
    expect(rows.map(([code]) => code)).toEqual(Object.values(EXIT));
    const meanings = german
      ? [
          "Gültig, ohne Lint-Probleme mit Schweregrad `error`",
          'Ungültige Struktur oder mindestens ein Lint-Problem mit `severity: "error"`',
          "Fehlbedienung oder ein defektes Tool",
          "Eine optionale Abhängigkeit fehlt",
        ]
      : [
          "Valid, with no error-severity lint",
          'Invalid structure or any `severity: "error"` lint issue',
          "Misuse or a broken tool",
          "A missing optional dependency",
        ];
    rows.forEach(([code, meaning]) =>
      expect.soft(meaning, `exit ${code}`).toContain(meanings[code]),
    );
    expect
      .soft(
        src.includes(
          german
            ? "`valid: true` allein bedeutet nicht Exit-Code 0"
            : "`valid: true` alone does not mean exit 0",
        ),
      )
      .toBe(true);
    expect
      .soft(
        src.includes(
          german
            ? "Warnungen und Info-Meldungen sind Hinweise, außer `localization.merge-tags-differ`: Diese Regel verursacht Exit-Code 1"
            : "Warnings and info are advisory except for `localization.merge-tags-differ`, which causes exit 1",
        ),
      )
      .toBe(true);
    expect.soft(rows.find(([code]) => code === EXIT.invalid)?.[1]).toContain(
      "localization.merge-tags-differ",
    );
    expect
      .soft(
        src.includes(
          german ? "ohne Ergebnisdokument" : "without a result document",
        ),
      )
      .toBe(true);
  });
});
