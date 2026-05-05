import { describe, expect, it } from "vitest";
import en from "../src/accessibility/messages/en";
import de from "../src/accessibility/messages/de";
import {
  formatMessage,
  getMessages,
  SUPPORTED_MESSAGE_LOCALES,
} from "../src/accessibility/messages";
import { RULES } from "../src";

describe("rule messages", () => {
  it("en and de share the same key set", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("every registered rule has an en + de message", () => {
    for (const rule of RULES) {
      expect(en).toHaveProperty(rule.meta.id);
      expect(de).toHaveProperty(rule.meta.id);
    }
  });

  it("placeholders match between locales for every key", () => {
    const placeholders = (s: string) =>
      Array.from(s.matchAll(/\{(\w+)\}/g))
        .map((m) => m[1])
        .sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(de[key])).toEqual(placeholders(en[key]));
    }
  });

  it("falls back to en for unsupported locales", () => {
    expect(getMessages("xx")).toBe(en);
  });

  it("strips region for matching", () => {
    expect(getMessages("de-AT")).toBe(de);
  });

  it("interpolates {name} placeholders", () => {
    const out = formatMessage("en", "img-alt-too-long", {
      length: 200,
      max: 125,
    });
    expect(out).toBe("Alt text is 200 characters; aim for under 125.");
  });

  it("uses the German template when locale=de", () => {
    const out = formatMessage("de", "img-missing-alt");
    expect(out).toContain("Alt-Text");
  });

  it("leaves unknown placeholders intact", () => {
    const out = formatMessage("en", "img-alt-too-long", { length: 200 });
    expect(out).toContain("{max}");
  });

  it("exports the supported locale list", () => {
    expect(SUPPORTED_MESSAGE_LOCALES.sort()).toEqual(["de", "en"]);
  });
});
