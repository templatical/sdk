import { describe, expect, it } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { i18nCapability } from "../src/config/capabilities/i18n";
import { ossSdkLocales } from "../src/i18n";

describe("i18nCapability", () => {
  it("defaults to English", () => {
    expect(buildCapabilityConfig(i18nCapability, {}, undefined).locale).toBe(
      "en",
    );
  });

  it("passes the chosen locale straight through", () => {
    expect(
      buildCapabilityConfig(i18nCapability, { locale: "de" }, undefined)
        .locale,
    ).toBe("de");
  });

  it("offers exactly the locales the editor supports", () => {
    const [control] = i18nCapability.controls;
    // Derived from the SDK's own glob-discovered list, never a hand-kept
    // copy: `getSupportedLocales()` grows when a locale file is dropped in,
    // and a second list here would silently stop matching it.
    expect(control.kind === "enum" && control.options).toEqual([
      ...ossSdkLocales,
    ]);
  });

  it("offers more than one locale, so the control is not inert", () => {
    expect(ossSdkLocales.length).toBeGreaterThan(1);
  });

  it("wraps no provider", () => {
    expect(i18nCapability.implFor).toBeUndefined();
  });
});
