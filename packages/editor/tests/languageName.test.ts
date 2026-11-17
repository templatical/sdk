import { describe, expect, it } from "vitest";
import { languageName } from "../src/utils/languageName";

describe("languageName", () => {
  it.each([
    ["fr", "Français"],
    ["de", "Deutsch"],
    ["ar", "العربية"],
    ["invalid_tag", "invalid_tag"],
  ])("labels %s as %s", (locale, expected) => {
    expect(languageName(locale)).toBe(expected);
  });

  it.each([
    ["en-GB", "English"],
    ["de-DE", "Deutsch"],
    ["es-ES", "Español"],
    ["zh-CN", "中文"],
  ])("names lone regional tag %s as %s", (locale, expected) => {
    expect(languageName(locale)).toBe(expected);
  });

  it("uses full names for siblings sharing a language", () => {
    const english = { siblings: ["en-GB", "en-US"] };
    expect(languageName("en-GB", english)).toBe("British English");
    expect(languageName("en-US", english)).toBe("American English");

    const chinese = { siblings: ["zh-Hans", "zh-Hant"] };
    expect(languageName("zh-Hans", chinese)).toBe("简体中文");
    expect(languageName("zh-Hant", chinese)).toBe("繁體中文");

    const baseAndRegion = { siblings: ["en", "en-GB"] };
    expect(languageName("en", baseAndRegion)).toBe("English");
    expect(languageName("en-GB", baseAndRegion)).toBe("British English");
  });

  it("ignores siblings with another language, the same canonical tag, or an invalid tag", () => {
    expect(languageName("de-DE", { siblings: ["de-DE", "en-GB"] })).toBe(
      "Deutsch",
    );
    expect(languageName("en-GB", { siblings: ["en-GB", "en-gb"] })).toBe(
      "English",
    );
    expect(languageName("en-GB", { siblings: ["invalid_tag"] })).toBe(
      "English",
    );
  });

  it("uses the host's label for a tag exactly as written", () => {
    const labels = { "en-GB": "  English (UK)  ", "de-DE": "deutsch" };
    const siblings = ["en-GB", "en-US"];
    expect(languageName("en-GB", { siblings, labels })).toBe("  English (UK)  ");
    expect(languageName("de-DE", { labels })).toBe("deutsch");
  });

  it("names a tag the host left out, or gave a blank label, by default", () => {
    const labels = { "en-GB": "English", fr: "", nl: "   " };
    expect(languageName("de-DE", { labels })).toBe("Deutsch");
    expect(languageName("fr", { labels })).toBe("Français");
    expect(languageName("nl", { labels })).toBe("Nederlands");
    expect(languageName("constructor", { labels: {} })).toBe("constructor");
  });
});
