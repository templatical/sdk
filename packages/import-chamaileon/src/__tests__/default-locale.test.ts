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
