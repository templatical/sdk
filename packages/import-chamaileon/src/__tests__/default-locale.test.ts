import { expect, it } from "vitest";
import { convertChamaileonTemplate } from "../index";

it("uses defaultLocale when the source declares none", () => {
  expect(
    convertChamaileonTemplate(
      { body: { type: "body", children: [] } },
      { defaultLocale: "de" },
    ).content.settings.locale,
  ).toBe("de");
});

it("falls back to en from an invalid defaultLocale and reports it", () => {
  const { content, report } = convertChamaileonTemplate(
    { body: { type: "body", children: [] } },
    { defaultLocale: "{{lang}}" },
  );
  expect(content.settings.locale).toBe("en");
  expect(report.warnings).toContain(
    'Ignored defaultLocale "{{lang}}": unsupported language tag. Used "en".',
  );
});
