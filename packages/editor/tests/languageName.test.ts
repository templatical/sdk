import { describe, expect, it } from "vitest";
import { languageName } from "../src/utils/languageName";

describe("languageName", () => {
  it.each([
    ["fr", "Français"],
    ["de", "Deutsch"],
    ["ar", "العربية"],
    ["invalid_tag", "invalid_tag"],
    ["qaa", "Qaa"],
  ])("labels %s as %s", (locale, expected) => {
    expect(languageName(locale)).toBe(expected);
  });

  it.each([
    ["en-GB", "English"],
    ["en-US", "English"],
    ["de-DE", "Deutsch"],
    ["de-AT", "Deutsch"],
    ["fr-FR", "Français"],
    ["es-ES", "Español"],
    ["nl-NL", "Nederlands"],
    ["it-IT", "Italiano"],
    ["da-DK", "Dansk"],
    ["sv-SE", "Svenska"],
    ["pl-PL", "Polski"],
    ["cs-CZ", "Čeština"],
    ["sk-SK", "Slovenčina"],
    ["zh-CN", "中文"],
    ["zh-Hant-HK", "中文"],
  ])("labels %s as %s, without its region", (locale, expected) => {
    expect(languageName(locale)).toBe(expected);
  });
});
