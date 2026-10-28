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
