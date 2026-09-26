import { describe, expect, it } from "vitest";
import { overlayTemplateSettings } from "../src/host/hostOverlays";

describe("overlayTemplateSettings", () => {
  it("omits the key when the query is absent", () => {
    expect(overlayTemplateSettings(new URLSearchParams())).toEqual({});
  });

  it("maps none to fields: false", () => {
    expect(
      overlayTemplateSettings(new URLSearchParams("settingsFields=none")),
    ).toEqual({ templateSettings: { fields: false } });
  });

  it("splits a comma allowlist", () => {
    expect(
      overlayTemplateSettings(
        new URLSearchParams("settingsFields=width,backgroundColor"),
      ),
    ).toEqual({
      templateSettings: { fields: ["width", "backgroundColor"] },
    });
  });
});
