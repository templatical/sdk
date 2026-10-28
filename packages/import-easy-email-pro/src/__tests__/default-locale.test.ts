import { expect, it } from "vitest";
import { convertEasyEmailProTemplate } from "../index";

it("uses defaultLocale when the source declares none", () => {
  expect(
    convertEasyEmailProTemplate(
      { type: "page", children: [] },
      { defaultLocale: "de" },
    ).content.settings.locale,
  ).toBe("de");
});
