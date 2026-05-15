import { describe, expect, it } from "vitest";
import en from "../../src/structure/messages/en";
import de from "../../src/structure/messages/de";
import {
  formatStructureMessage,
  getStructureMessages,
  SUPPORTED_STRUCTURE_MESSAGE_LOCALES,
} from "../../src/structure/messages";
import { STRUCTURE_RULES } from "../../src";

describe("structure rule messages", () => {
  it("en and de share the same key set", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("every registered structure rule has an en + de message", () => {
    for (const rule of STRUCTURE_RULES) {
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
    expect(getStructureMessages("xx")).toBe(en);
  });

  it("strips region for matching", () => {
    expect(getStructureMessages("de-AT")).toBe(de);
  });

  it("interpolates {name} placeholders", () => {
    const out = formatStructureMessage("en", "structure.duplicate-block-id", {
      count: 3,
    });
    expect(out).toBe(
      "Block id appears 3 times in the tree. Each block must have a unique id.",
    );
  });

  it("uses the German template when locale=de", () => {
    const out = formatStructureMessage("de", "structure.empty-section");
    expect(out).toContain("Sektion");
  });

  it("exports the supported locale list", () => {
    expect(SUPPORTED_STRUCTURE_MESSAGE_LOCALES.sort()).toEqual(["de", "en"]);
  });
});
