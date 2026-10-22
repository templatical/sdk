import { describe, expect, it } from "vitest";
import en from "../../src/compatibility/messages/en";
import de from "../../src/compatibility/messages/de";
import {
  getCompatibilityMessages,
  formatCompatibilityMessage,
  SUPPORTED_COMPATIBILITY_MESSAGE_LOCALES,
} from "../../src/compatibility/messages";

describe("compatibility messages", () => {
  it("keeps EN and DE placeholders in every authored field", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const key of Object.keys(en.templates) as Array<
      keyof typeof en.templates
    >)
      expect(placeholders(de.templates[key]), key).toEqual(
        placeholders(en.templates[key]),
      );
    for (const key of Object.keys(en.features) as Array<
      keyof typeof en.features
    >) {
      expect(placeholders(de.features[key].feature), `${key}/feature`).toEqual(
        placeholders(en.features[key].feature),
      );
      expect(
        placeholders(de.features[key].suggestion),
        `${key}/suggestion`,
      ).toEqual(placeholders(en.features[key].suggestion));
    }
    for (const key of Object.keys(en.hand) as Array<keyof typeof en.hand>) {
      expect(placeholders(de.hand[key].message), `${key}/message`).toEqual(
        placeholders(en.hand[key].message),
      );
      expect(
        placeholders(de.hand[key].suggestion),
        `${key}/suggestion`,
      ).toEqual(placeholders(en.hand[key].suggestion));
    }
  });

  it("discovers EN and DE and falls back to EN", () => {
    expect(SUPPORTED_COMPATIBILITY_MESSAGE_LOCALES.sort()).toEqual([
      "de",
      "en",
    ]);
    expect(getCompatibilityMessages("de-AT")).toBe(de);
    expect(getCompatibilityMessages("fr")).toBe(en);
  });

  it("returns a localized problem and action", () => {
    expect(
      formatCompatibilityMessage("de", "compat.html-svg", {
        unsupported: "Outlook",
        excerpt: "<svg>",
      }),
    ).toEqual({
      message: "Ein eingebettetes <svg>-Element funktioniert in Outlook nicht.",
      suggestion: "Verwende stattdessen ein PNG- oder JPEG-Bild.",
    });
  });
});
