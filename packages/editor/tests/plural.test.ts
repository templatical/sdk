import { describe, expect, it } from "vitest";
import { plural } from "../src/i18n/plural";

describe("plural", () => {
  it.each([
    ["en", 1, "one 1"],
    ["en", 2, "other 2"],
    ["ja", 1, "other 1"],
    ["fr", 0, "one 0"],
    ["fr", 1, "one 1"],
    ["fr", 1000000, "other 1000000"],
    ["en_US!", 1, "one 1"],
    ["en_US!", 2, "other 2"],
  ])("selects %s at %i", (locale, count, expected) => {
    expect(
      plural({ one: "one {count}", other: "other {count}" }, count, locale),
    ).toBe(expected);
  });

  it("fills count and named params, leaving unknown placeholders intact", () => {
    expect(
      plural(
        {
          one: "{count} field in {language} {unknown}",
          other: "{count} fields in {language} {unknown}",
        },
        2,
        "en",
        { language: "Deutsch", count: 99 },
      ),
    ).toBe("2 fields in Deutsch {unknown}");
  });
});
