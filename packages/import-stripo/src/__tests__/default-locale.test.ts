import { expect, it } from "vitest";
import { convertStripoTemplate } from "../index";

it("uses defaultLocale when the source declares none", () => {
  expect(
    convertStripoTemplate(
      '<table class="es-wrapper"><tr><td>Hello</td></tr></table>',
      { defaultLocale: "de" },
    ).content.settings.locale,
  ).toBe("de");
  expect(
    convertStripoTemplate(
      '<html lang="fr_FR"><body><table class="es-wrapper"><tr><td>Hello</td></tr></table></body></html>',
      { defaultLocale: "de" },
    ).content.settings.locale,
  ).toBe("fr-FR");
});

it.each([
  [
    "Stripo markup",
    '<table class="es-wrapper"><tr><td>Hello</td></tr></table>',
  ],
  ["generic HTML", "<table><tr><td>Hello</td></tr></table>"],
])(
  "falls back from an invalid <html lang> in %s and reports it",
  (_kind, body) => {
    const { content, report } = convertStripoTemplate(
      `<html lang="{{lang}}"><body>${body}</body></html>`,
    );
    expect(content.settings.locale).toBe("en");
    expect(
      report.warnings.filter((warning) => warning.startsWith("Ignored ")),
    ).toEqual([
      'Ignored the source\'s default language "{{lang}}": unsupported language tag. Used "en".',
    ]);
  },
);

it("falls back from an invalid defaultLocale and reports it", () => {
  const { content, report } = convertStripoTemplate(
    '<table class="es-wrapper"><tr><td>Hello</td></tr></table>',
    { defaultLocale: "{{lang}}" },
  );
  expect(content.settings.locale).toBe("en");
  expect(
    report.warnings.filter((warning) => warning.startsWith("Ignored ")),
  ).toEqual([
    'Ignored defaultLocale "{{lang}}": unsupported language tag. Used "en".',
  ]);
});
