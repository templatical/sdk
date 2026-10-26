import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  resolveLocale,
  safeClone,
  sourceHash,
  writePath,
} from "../src";

describe("localized path writes", () => {
  it("replaces an id-addressed element with a copy and leaves missing ids untouched", () => {
    const target = {
      items: [
        { id: "home", text: "Home" },
        { id: "about", text: "About" },
      ],
    };
    const replacement = { id: "home", text: "Start" };
    expect(writePath(target, "items.home", replacement)).toBe(true);
    expect(target.items).toEqual([replacement, { id: "about", text: "About" }]);
    replacement.text = "Changed input";
    expect(target.items[0].text).toBe("Start");
    const before = safeClone(target);
    expect(writePath(target, "items.missing", replacement)).toBe(false);
    expect(target).toEqual(before);
  });

  it("projects translated settings text and property overrides without changing the base", () => {
    const content = createDefaultTemplateContent();
    content.settings.locale = "en";
    content.settings.locales = ["de"];
    content.settings.preheaderText = "Hello";
    content.settings.l10n = {
      de: {
        text: {
          preheaderText: { value: "Hallo", source: sourceHash("Hello") },
        },
        set: { direction: "rtl" },
      },
    };
    const before = safeClone(content);
    expect(resolveLocale(content, "de").settings).toMatchObject({
      locale: "de",
      preheaderText: "Hallo",
      direction: "rtl",
    });
    expect(content).toEqual(before);
  });
});
