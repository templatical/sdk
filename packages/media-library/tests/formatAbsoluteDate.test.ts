// This mirrors `packages/editor/src/utils/formatAbsoluteDateTime.ts`. The two
// are deliberate copies rather than a shared module: media-library owns its own
// i18n and cannot import from the editor (the dependency runs the other way),
// and `@templatical/types` is the dependency-free leaf, not a home for display
// helpers. The cases below are the editor suite's cases, so a behavioural drift
// between the copies fails here instead of going unnoticed.
import { describe, expect, it } from "vitest";
import { formatAbsoluteDate } from "../src/utils/formatAbsoluteDate";

const ISO = "2026-03-04T15:30:00.000Z";
const OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

describe("formatAbsoluteDate", () => {
  // The media library rendered dates in the browser's language while its own
  // chrome was translated from the editor's `locale` prop.
  it("formats in the locale it is given, not the runtime's", () => {
    expect(formatAbsoluteDate(ISO, "de", { month: "long" })).toContain("März");
  });

  it("formats the same instant differently per locale", () => {
    expect(formatAbsoluteDate(ISO, "fr", { month: "long" })).toContain("mars");
    expect(formatAbsoluteDate(ISO, "en", { month: "long" })).toContain("March");
  });

  it("honours the requested field set", () => {
    const result = formatAbsoluteDate(ISO, "en", OPTIONS);
    expect(result).toContain("2026");
    expect(result).toContain("Mar");
  });

  // The locale arrives as a prop from the host editor's own config, which is
  // free text — a RangeError would take down the grid for a caption.
  it.each(["not a locale", "", "  ", "de;", "!!"])(
    "falls back to the runtime locale instead of throwing on a malformed tag: %s",
    (locale) => {
      expect(formatAbsoluteDate(ISO, locale, OPTIONS)).toBe(
        new Date(ISO).toLocaleDateString(undefined, OPTIONS),
      );
    },
  );

  it("uses the runtime locale when none is configured", () => {
    expect(formatAbsoluteDate(ISO, undefined, OPTIONS)).toBe(
      new Date(ISO).toLocaleDateString(undefined, OPTIONS),
    );
  });

  it("passes a well-formed but unknown tag straight to Intl", () => {
    expect(formatAbsoluteDate(ISO, "zz", OPTIONS).length).toBeGreaterThan(0);
  });

  it("normalizes an underscore tag rather than treating it as malformed", () => {
    expect(formatAbsoluteDate(ISO, "de_DE", { month: "long" })).toContain(
      "März",
    );
  });

  it.each(["", "not a date", "2026-13-45"])(
    "returns an empty string for an unparseable date: %s",
    (iso) => {
      expect(formatAbsoluteDate(iso, "de", OPTIONS)).toBe("");
    },
  );
});
