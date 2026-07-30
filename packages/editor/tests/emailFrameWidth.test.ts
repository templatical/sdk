import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL_WIDTH,
  MOBILE_EMAIL_WIDTH,
  getEmailFrameWidth,
} from "../src/utils/emailFrameWidth";
import { createDefaultTemplateContent } from "@templatical/types";
import type { TemplateSettings } from "@templatical/types";

/**
 * One helper backs three surfaces — the canvas, `BlockPreviewCanvas`, and the
 * save dialog's scaled rows — because they must agree. The row divides by this
 * number to compute its `transform: scale()`, so a disagreement scales every row
 * by the wrong factor. These cases pin the contract that agreement rests on.
 */
function settings(overrides: Partial<TemplateSettings>): TemplateSettings {
  return { ...createDefaultTemplateContent().settings, ...overrides };
}

describe("getEmailFrameWidth", () => {
  it("uses the template's body width on desktop", () => {
    expect(getEmailFrameWidth(settings({ width: 720 }), "desktop")).toBe(720);
  });

  it("defaults to desktop when no viewport is given", () => {
    // The saved-blocks surfaces have no viewport control and rely on this.
    expect(getEmailFrameWidth(settings({ width: 720 }))).toBe(720);
  });

  it("clamps to the mobile width regardless of the template's width", () => {
    // A phone viewport is narrower than any sensible body, so the template's own
    // width must not win here.
    expect(getEmailFrameWidth(settings({ width: 720 }), "mobile")).toBe(
      MOBILE_EMAIL_WIDTH,
    );
    expect(getEmailFrameWidth(settings({ width: 320 }), "mobile")).toBe(
      MOBILE_EMAIL_WIDTH,
    );
  });

  it("falls back to the default width without settings", () => {
    // Headless mounts and tests pass nothing.
    expect(getEmailFrameWidth(undefined)).toBe(DEFAULT_EMAIL_WIDTH);
    expect(getEmailFrameWidth(undefined, "desktop")).toBe(DEFAULT_EMAIL_WIDTH);
  });

  it("still clamps to mobile without settings", () => {
    expect(getEmailFrameWidth(undefined, "mobile")).toBe(MOBILE_EMAIL_WIDTH);
  });

  it("exposes concrete constants the canvas and previews share", () => {
    expect(MOBILE_EMAIL_WIDTH).toBe(375);
    expect(DEFAULT_EMAIL_WIDTH).toBe(600);
    // The default must match the template factory, or an unset width previews at
    // a different size than it renders.
    expect(createDefaultTemplateContent().settings.width).toBe(
      DEFAULT_EMAIL_WIDTH,
    );
  });
});
