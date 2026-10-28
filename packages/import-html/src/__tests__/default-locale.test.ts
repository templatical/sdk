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
