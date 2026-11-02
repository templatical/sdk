import { describe, expect, it } from "vitest";
import * as quality from "../../src";

describe("localization messages", () => {
  it("has English/German key and placeholder parity for every registered rule", () => {
    expect(quality.getLocalizationMessages).toBeTypeOf("function");
    const en = quality.getLocalizationMessages("en");
    const de = quality.getLocalizationMessages("de");
    expect(Object.keys(en).sort()).toEqual([
      "localization.merge-tags-differ",
      "localization.stale",
      "localization.untranslated",
    ]);
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    const placeholders = (value: { message: string; suggestion: string }) =>
      [...(value.message + " " + value.suggestion).matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .sort();
    for (const rule of quality.LOCALIZATION_RULES) {
      const key = rule.meta.id as keyof typeof en;
      expect(en[key]).toBeDefined();
      expect(placeholders(de[key])).toEqual(placeholders(en[key]));
    }
  });

  it("falls back by language and interpolates fields while preserving missing placeholders", () => {
    expect(quality.formatLocalizationMessage).toBeTypeOf("function");
    expect(quality.getLocalizationMessages("de-AT")).toBe(
      quality.getLocalizationMessages("de"),
    );
    expect(quality.getLocalizationMessages("xx")).toBe(
      quality.getLocalizationMessages("en"),
    );
    expect(quality.SUPPORTED_LOCALIZATION_MESSAGE_LOCALES.sort()).toEqual([
      "de",
      "en",
    ]);
    expect(
      quality.formatLocalizationMessage("en", "localization.untranslated", {
        field: "alt",
      }).message,
    ).toBe("The field alt has no translation.");
    expect(
      quality.formatLocalizationMessage("de", "localization.stale").message,
    ).toContain("{field}");
  });
});
