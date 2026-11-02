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
});
