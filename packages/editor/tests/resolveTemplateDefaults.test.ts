import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_DEFAULTS } from "@templatical/types";
import { resolveTemplateDefaults } from "../src/utils/resolveTemplateDefaults";

describe("resolveTemplateDefaults", () => {
  // A fresh template declared `lang="en"` in the rendered email no matter what
  // language the editor was in, so a German-authored email announced itself as
  // English to every screen reader that opened it.
  it("seeds the content language from the editor locale", () => {
    expect(resolveTemplateDefaults({ locale: "de" }).locale).toBe("de");
  });

  it("keeps a consumer's own content language over the editor locale", () => {
    expect(
      resolveTemplateDefaults({
        locale: "de",
        templateDefaults: { locale: "en" },
      }).locale,
    ).toBe("en");
  });

  // `<html lang>` wants the region, unlike the UI bundles, which strip it: an
  // `en-GB` email is legitimately not `en-US` to a screen reader.
  it("keeps the region rather than stripping it to a base language", () => {
    expect(resolveTemplateDefaults({ locale: "pt-BR" }).locale).toBe("pt-BR");
    expect(resolveTemplateDefaults({ locale: "de-AT" }).locale).toBe("de-AT");
  });

  it("normalizes an underscore tag to BCP-47's hyphen", () => {
    expect(resolveTemplateDefaults({ locale: "de_DE" }).locale).toBe("de-DE");
  });

  it("trims surrounding whitespace", () => {
    expect(resolveTemplateDefaults({ locale: "  fr  " }).locale).toBe("fr");
  });

  // Never emit a `lang` the renderer would stamp verbatim into `<mjml lang>`.
  it.each(["", "   ", "not a locale", "de;", "<script>"])(
    "leaves the locale unset for a value that is not a language tag: %s",
    (locale) => {
      expect(resolveTemplateDefaults({ locale })?.locale).toBeUndefined();
    },
  );

  it("leaves the locale unset when the editor has no locale configured", () => {
    expect(resolveTemplateDefaults({})?.locale).toBeUndefined();
  });

  // The helper only fills in `locale` — every other template default is the
  // consumer's business, and inventing one here would shadow
  // DEFAULT_TEMPLATE_DEFAULTS.
  it("passes every other template default through untouched", () => {
    const templateDefaults = { width: 700, backgroundColor: "#eeeeee" };
    expect(resolveTemplateDefaults({ locale: "de", templateDefaults })).toEqual({
      width: 700,
      backgroundColor: "#eeeeee",
      locale: "de",
    });
  });

  it("returns undefined when there is nothing at all to contribute", () => {
    expect(resolveTemplateDefaults({})).toBeUndefined();
  });

  // An unset locale must not become `"en"` here: `createDefaultTemplateContent`
  // already falls back to DEFAULT_TEMPLATE_DEFAULTS, and duplicating that
  // default gives two places to change it.
  it("does not restate the factory's own English fallback", () => {
    expect(DEFAULT_TEMPLATE_DEFAULTS.locale).toBe("en");
    expect(resolveTemplateDefaults({ templateDefaults: { width: 700 } })).toEqual(
      { width: 700 },
    );
  });
});
