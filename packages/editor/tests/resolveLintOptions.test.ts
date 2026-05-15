import { describe, expect, it } from "vitest";
import { resolveLintOptions } from "../src/utils/resolveLintOptions";

describe("resolveLintOptions", () => {
  it("forces editor locale onto the linter options", () => {
    const out = resolveLintOptions({ locale: "de" });
    expect(out.locale).toBe("de");
  });

  it("ignores lint.locale supplied by the consumer", () => {
    const out = resolveLintOptions({
      locale: "de",
      lint: { locale: "en", rules: { "a11y.img-missing-alt": "warning" } },
    });
    expect(out.locale).toBe("de");
  });

  it("preserves all other lint options", () => {
    const out = resolveLintOptions({
      locale: "de",
      lint: {
        rules: { "a11y.img-missing-alt": "warning" },
        thresholds: { minFontSize: 16 },
        disabled: false,
      },
    });
    expect(out.rules).toEqual({ "a11y.img-missing-alt": "warning" });
    expect(out.thresholds).toEqual({ minFontSize: 16 });
    expect(out.disabled).toBe(false);
  });

  it("returns undefined locale when editor locale is unset", () => {
    const out = resolveLintOptions({});
    expect(out.locale).toBeUndefined();
  });

  it("works when lint is omitted entirely", () => {
    const out = resolveLintOptions({ locale: "de" });
    expect(out).toEqual({ locale: "de" });
  });
});
