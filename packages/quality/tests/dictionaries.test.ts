import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/accessibility/dictionaries/en";
import de from "../src/accessibility/dictionaries/de";
import {
  getDictionary,
  SUPPORTED_DICTIONARY_LOCALES,
} from "../src/accessibility/dictionaries";

describe("dictionaries", () => {
  it("en and de share the same key set", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("returns the union regardless of unknown locale (no crash, full coverage)", () => {
    const dict = getDictionary("xx");
    // Includes English phrases
    expect(dict.vagueLinkText).toContain("click here");
    // And every other registered locale's phrases
    expect(dict.vagueLinkText).toContain("hier klicken");
  });

  it("returns the same union regardless of locale argument", () => {
    expect(getDictionary("de-AT")).toBe(getDictionary("de"));
    expect(getDictionary("en")).toBe(getDictionary("xx"));
  });

  it("unions every registered locale so cross-language CTAs match anywhere", () => {
    const dict = getDictionary("de");
    // German phrase
    expect(dict.vagueLinkText).toContain("hier klicken");
    // English phrase — flags an English CTA in a German-locale template
    expect(dict.vagueLinkText).toContain("click here");
    expect(dict.vagueLinkText).toContain("read more");
  });

  it("does not duplicate phrases when locale is already English", () => {
    const dict = getDictionary("en");
    const counts: Record<string, number> = {};
    for (const phrase of dict.vagueLinkText) {
      counts[phrase] = (counts[phrase] ?? 0) + 1;
    }
    for (const c of Object.values(counts)) expect(c).toBe(1);
  });

  it("exports the supported locale list", () => {
    expect(SUPPORTED_DICTIONARY_LOCALES.sort()).toEqual(["de", "en"]);
  });

  it("each locale has non-empty phrase arrays", () => {
    for (const locale of [en, de]) {
      expect(locale.vagueLinkText.length).toBeGreaterThan(0);
      expect(locale.vagueButtonLabels.length).toBeGreaterThan(0);
    }
  });

  it("auto-discovers every locale file in dictionaries/ (no static import list)", () => {
    const dir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../src/accessibility/dictionaries",
    );
    const onDisk = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "index.ts")
      .map((f) => f.replace(/\.ts$/, ""))
      .sort();
    expect(SUPPORTED_DICTIONARY_LOCALES.slice().sort()).toEqual(onDisk);
  });
});
