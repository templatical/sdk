import { expect, it } from "vitest";
import { convertHtmlTemplate } from "../index";

it("uses defaultLocale when the source declares none", () => {
  expect(
    convertHtmlTemplate("<p>Hello</p>", { defaultLocale: "de" }).content
      .settings.locale,
  ).toBe("de");
  expect(
    convertHtmlTemplate('<html lang="fr_FR"><body><p>Hello</p></body></html>', {
      defaultLocale: "de",
    }).content.settings.locale,
  ).toBe("fr-FR");
});

it.each([
  [
    '<html lang="{{lang}}"><body><p>Hello</p></body></html>',
    undefined,
    "en",
    [
      'Ignored the source\'s default language "{{lang}}": unsupported language tag. Used "en".',
    ],
  ],
  [
    '<html lang="{{lang}}"><body><p>Hello</p></body></html>',
    "de_DE",
    "de-DE",
    [
      'Ignored the source\'s default language "{{lang}}": unsupported language tag. Used "de-DE".',
    ],
  ],
  [
    "<p>Hello</p>",
    "{{lang}}",
    "en",
    ['Ignored defaultLocale "{{lang}}": unsupported language tag. Used "en".'],
  ],
  [
    '<html lang="x"><body><p>Hello</p></body></html>',
    "not a tag",
    "en",
    [
      'Ignored the source\'s default language "x": unsupported language tag. Used "en".',
      'Ignored defaultLocale "not a tag": unsupported language tag. Used "en".',
    ],
  ],
])(
  "falls back from an invalid default language in %s with defaultLocale %s",
  (html, defaultLocale, locale, warnings) => {
    const { content, report } = convertHtmlTemplate(html, { defaultLocale });
    expect(content.settings.locale).toBe(locale);
    expect(
      report.warnings.filter((warning) => warning.startsWith("Ignored ")),
    ).toEqual(warnings);
  },
);

it("adds no language warning for a valid default", () => {
  const { report } = convertHtmlTemplate(
    '<html lang="fr_FR"><body><p>Hello</p></body></html>',
    { defaultLocale: "de" },
  );
  expect(
    report.warnings.filter((warning) => warning.startsWith("Ignored ")),
  ).toEqual([]);
});
