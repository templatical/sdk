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
