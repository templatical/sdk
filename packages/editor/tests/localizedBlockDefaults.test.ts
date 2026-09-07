import { describe, expect, it } from "vitest";
import {
  BUTTON_BLOCK_DEFAULTS,
  PARAGRAPH_BLOCK_DEFAULTS,
  TITLE_BLOCK_DEFAULTS,
} from "@templatical/types";
import ca from "../src/i18n/locales/ca";
import de from "../src/i18n/locales/de";
import en from "../src/i18n/locales/en";
import es from "../src/i18n/locales/es";
import fr from "../src/i18n/locales/fr";
import nl from "../src/i18n/locales/nl";
import ptBR from "../src/i18n/locales/pt-BR";
import { localizedBlockDefaults } from "../src/utils/localizedBlockDefaults";

describe("localizedBlockDefaults", () => {
  it("wraps the localized title text as an HTML paragraph", () => {
    expect(localizedBlockDefaults(de).title?.content).toBe(
      "<p>Geben Sie Ihren Titel ein</p>",
    );
  });

  it("wraps the localized paragraph text as an HTML paragraph", () => {
    expect(localizedBlockDefaults(de).paragraph?.content).toBe(
      "<p>Geben Sie hier Ihren Text ein</p>",
    );
  });

  it("carries the localized button label as plain text, unwrapped", () => {
    expect(localizedBlockDefaults(de).button?.text).toBe("Hier klicken");
  });

  // The English arm must be byte-identical to the factory defaults, or shipping
  // this changes behaviour for every consumer who never set a locale.
  it("reproduces the English factory defaults verbatim", () => {
    const defaults = localizedBlockDefaults(en);
    expect(defaults.title?.content).toBe(TITLE_BLOCK_DEFAULTS.content);
    expect(defaults.paragraph?.content).toBe(PARAGRAPH_BLOCK_DEFAULTS.content);
    expect(defaults.button?.text).toBe(BUTTON_BLOCK_DEFAULTS.text);
  });

  // Only the three author-facing prompts belong here. `video.alt` and the
  // countdown labels are recipient-facing content and key off the template's
  // own `settings.locale`, not the editing UI's — see localizedContentDefaults.
  it("touches only title, paragraph and button", () => {
    expect(Object.keys(localizedBlockDefaults(de)).sort()).toEqual([
      "button",
      "paragraph",
      "title",
    ]);
  });

  it("overrides nothing but the text — no colours, sizes or styles", () => {
    const defaults = localizedBlockDefaults(de);
    expect(Object.keys(defaults.title ?? {})).toEqual(["content"]);
    expect(Object.keys(defaults.paragraph ?? {})).toEqual(["content"]);
    expect(Object.keys(defaults.button ?? {})).toEqual(["text"]);
  });

  it.each([
    ["ca", ca],
    ["de", de],
    ["en", en],
    ["es", es],
    ["fr", fr],
    ["nl", nl],
    ["pt-BR", ptBR],
  ])("resolves a non-empty prompt for every OSS locale: %s", (_name, t) => {
    const defaults = localizedBlockDefaults(t);
    expect(defaults.title?.content).toMatch(/^<p>.+<\/p>$/);
    expect(defaults.paragraph?.content).toMatch(/^<p>.+<\/p>$/);
    expect((defaults.button?.text ?? "").length).toBeGreaterThan(0);
  });

  // Every locale must differ from English, or the namespace is untranslated.
  it.each([
    ["ca", ca],
    ["de", de],
    ["es", es],
    ["fr", fr],
    ["nl", nl],
    ["pt-BR", ptBR],
  ])("translates the prompts away from English: %s", (_name, t) => {
    const defaults = localizedBlockDefaults(t);
    expect(defaults.title?.content).not.toBe(TITLE_BLOCK_DEFAULTS.content);
    expect(defaults.paragraph?.content).not.toBe(
      PARAGRAPH_BLOCK_DEFAULTS.content,
    );
    expect(defaults.button?.text).not.toBe(BUTTON_BLOCK_DEFAULTS.text);
  });
});
