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
      lint: {
        locale: "en",
        accessibility: { rules: { "a11y.img-missing-alt": "warning" } },
      },
    });
    expect(out.locale).toBe("de");
  });

  it("preserves all other lint options including nested per-tool config", () => {
    const out = resolveLintOptions({
      locale: "de",
      lint: {
        accessibility: {
          rules: { "a11y.img-missing-alt": "warning" },
          thresholds: { minFontSize: 16 },
        },
        links: { nonProductionHosts: ["*.preview.*"] },
        disabled: false,
      },
    });
    expect(out.accessibility).toEqual({
      rules: { "a11y.img-missing-alt": "warning" },
      thresholds: { minFontSize: 16 },
    });
    expect(out.links).toEqual({ nonProductionHosts: ["*.preview.*"] });
    expect(out.disabled).toBe(false);
  });

  it("preserves per-tool false disables", () => {
    const out = resolveLintOptions({
      locale: "en",
      lint: { accessibility: false, structure: false, links: false },
    });
    expect(out.accessibility).toBe(false);
    expect(out.structure).toBe(false);
    expect(out.links).toBe(false);
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
