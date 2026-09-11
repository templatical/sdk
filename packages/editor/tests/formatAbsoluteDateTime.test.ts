import { describe, expect, it } from "vitest";
import { formatAbsoluteDateTime } from "../src/utils/formatAbsoluteDateTime";

const ISO = "2026-03-04T15:30:00.000Z";

describe("formatAbsoluteDateTime", () => {
  // These labels sat beside fully translated chrome while reading in whatever
  // language the OS happened to be in: German header, English month name.
  it("formats in the locale it is given, not the runtime's", () => {
    const de = formatAbsoluteDateTime(ISO, "de", {
      month: "long",
      day: "numeric",
    });
    expect(de).toContain("März");
  });

  it("formats the same instant differently per locale", () => {
    const options = { month: "long", day: "numeric" } as const;
    expect(formatAbsoluteDateTime(ISO, "fr", options)).toContain("mars");
    expect(formatAbsoluteDateTime(ISO, "en", options)).toContain("March");
  });

  it("honours the requested field set", () => {
    const withYear = formatAbsoluteDateTime(ISO, "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(withYear).toContain("2026");
    expect(withYear).toContain("Mar");
  });

  // A malformed tag makes Intl throw RangeError, which would take down the
  // whole component render for what is a cosmetic label. `config.locale` is
  // consumer input, so this is reachable.
  it.each(["not a locale", "", "  ", "de;", "!!"])(
    "falls back to the runtime locale instead of throwing on a malformed tag: %s",
    (locale) => {
      const result = formatAbsoluteDateTime(ISO, locale);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    },
  );

  it("uses the runtime locale when none is configured", () => {
    const result = formatAbsoluteDateTime(ISO, undefined);
    expect(result).toBe(new Date(ISO).toLocaleString());
  });

  // A well-formed but unregistered tag is Intl's own business — it resolves a
  // fallback internally and must not be rewritten here.
  it("passes a well-formed but unknown tag straight to Intl", () => {
    expect(formatAbsoluteDateTime(ISO, "zz").length).toBeGreaterThan(0);
  });

  it("normalizes an underscore tag rather than treating it as malformed", () => {
    expect(
      formatAbsoluteDateTime(ISO, "de_DE", { month: "long" }),
    ).toContain("März");
  });

  // Every caller renders this into a `title`, where "Invalid Date" is worse
  // than no tooltip at all.
  it.each(["", "not a date", "2026-13-45"])(
    "returns an empty string for an unparseable date: %s",
    (iso) => {
      expect(formatAbsoluteDateTime(iso, "de")).toBe("");
    },
  );

  it("defaults to a full date and time when given no options", () => {
    const result = formatAbsoluteDateTime(ISO, "en-GB");
    expect(result).toBe(new Date(ISO).toLocaleString("en-GB"));
  });
});
