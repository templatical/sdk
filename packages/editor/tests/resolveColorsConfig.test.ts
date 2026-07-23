import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RESOLVED_COLORS,
  resolveColorsConfig,
} from "../src/utils/resolveColorsConfig";

describe("resolveColorsConfig", () => {
  it("returns the default (no presets, custom allowed) when unconfigured", () => {
    expect(resolveColorsConfig(undefined)).toEqual({
      presets: [],
      allowCustom: true,
      allowCustomIgnored: false,
    });
  });

  it("keeps custom entry on by default when only presets are given", () => {
    expect(resolveColorsConfig({ presets: ["#111111", "#222222"] })).toEqual({
      presets: ["#111111", "#222222"],
      allowCustom: true,
      allowCustomIgnored: false,
    });
  });

  it("locks to the palette when allowCustom is false and presets exist", () => {
    expect(
      resolveColorsConfig({ presets: ["#111111"], allowCustom: false }),
    ).toEqual({
      presets: ["#111111"],
      allowCustom: false,
      allowCustomIgnored: false,
    });
  });

  it("ignores allowCustom:false with no presets and signals it (without logging)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = resolveColorsConfig({ allowCustom: false });

    // Forced back to true, flagged for the caller — the util itself never logs.
    expect(result).toEqual({
      presets: [],
      allowCustom: true,
      allowCustomIgnored: true,
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  describe("with a fallback (nested resolution)", () => {
    const base = {
      presets: ["#0b5cff"],
      allowCustom: true,
      allowCustomIgnored: false,
    };

    it("inherits the fallback when the input sets nothing", () => {
      expect(resolveColorsConfig({}, base)).toEqual({
        presets: ["#0b5cff"],
        allowCustom: true,
        allowCustomIgnored: false,
      });
    });

    it("overrides presets while inheriting allowCustom", () => {
      expect(resolveColorsConfig({ presets: ["#ff6600"] }, base)).toEqual({
        presets: ["#ff6600"],
        allowCustom: true,
        allowCustomIgnored: false,
      });
    });

    it("locks to the inherited palette when the input sets allowCustom:false", () => {
      // Opts out of custom entry but sets no presets of its own — it inherits
      // the fallback presets, so this is valid (not ignored).
      expect(resolveColorsConfig({ allowCustom: false }, base)).toEqual({
        presets: ["#0b5cff"],
        allowCustom: false,
        allowCustomIgnored: false,
      });
    });

    it("flags allowCustom:false as ignored when no presets resolve anywhere in the chain", () => {
      expect(
        resolveColorsConfig({ allowCustom: false }, DEFAULT_RESOLVED_COLORS),
      ).toEqual({
        presets: [],
        allowCustom: true,
        allowCustomIgnored: true,
      });
    });
  });
});
