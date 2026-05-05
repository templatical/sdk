import { describe, expect, it } from "vitest";
import { resolveAccessibilityOptions } from "../src/utils/resolveAccessibilityOptions";

describe("resolveAccessibilityOptions", () => {
  it("forces editor locale onto the linter options", () => {
    const out = resolveAccessibilityOptions({ locale: "de" });
    expect(out.locale).toBe("de");
  });

  it("ignores accessibility.locale supplied by the consumer", () => {
    const out = resolveAccessibilityOptions({
      locale: "de",
      accessibility: { locale: "en", rules: { "img-missing-alt": "warning" } },
    });
    expect(out.locale).toBe("de");
  });

  it("preserves all other accessibility options", () => {
    const out = resolveAccessibilityOptions({
      locale: "de",
      accessibility: {
        rules: { "img-missing-alt": "warning" },
        thresholds: { minFontSize: 16 },
        disabled: false,
      },
    });
    expect(out.rules).toEqual({ "img-missing-alt": "warning" });
    expect(out.thresholds).toEqual({ minFontSize: 16 });
    expect(out.disabled).toBe(false);
  });

  it("returns undefined locale when editor locale is unset", () => {
    const out = resolveAccessibilityOptions({});
    expect(out.locale).toBeUndefined();
  });

  it("works when accessibility is omitted entirely", () => {
    const out = resolveAccessibilityOptions({ locale: "de" });
    expect(out).toEqual({ locale: "de" });
  });
});
