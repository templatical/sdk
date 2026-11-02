import { expect, it } from "vitest";
import { convertMjmlTemplate } from "../index";

it("uses defaultLocale when the source declares none", () => {
  expect(
    convertMjmlTemplate("<mjml><mj-body></mj-body></mjml>", {
      defaultLocale: "de",
    }).content.settings.locale,
  ).toBe("de");
  expect(
    convertMjmlTemplate('<mjml lang="fr_FR"><mj-body></mj-body></mjml>', {
      defaultLocale: "de",
    }).content.settings.locale,
  ).toBe("fr-FR");
});

it.each([
  [
    '<mjml lang="{{lang}}"><mj-body></mj-body></mjml>',
    undefined,
    "en",
    [
      'Ignored the source\'s default language "{{lang}}": unsupported language tag. Used "en".',
    ],
  ],
  [
    '<mjml lang="{{lang}}"><mj-body></mj-body></mjml>',
    "de",
    "de",
    [
      'Ignored the source\'s default language "{{lang}}": unsupported language tag. Used "de".',
    ],
  ],
  [
    "<mjml><mj-body></mj-body></mjml>",
    "{{lang}}",
    "en",
    ['Ignored defaultLocale "{{lang}}": unsupported language tag. Used "en".'],
  ],
])(
  "falls back from an invalid default language in %s with defaultLocale %s",
  (mjml, defaultLocale, locale, warnings) => {
    const { content, report } = convertMjmlTemplate(mjml, { defaultLocale });
    expect(content.settings.locale).toBe(locale);
    expect(
      report.warnings.filter((warning) => warning.startsWith("Ignored ")),
    ).toEqual(warnings);
  },
);
