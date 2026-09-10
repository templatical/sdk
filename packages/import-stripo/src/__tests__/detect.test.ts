import { describe, expect, it } from "vitest";
import { detectStripoKind, isStripoHtml } from "../detect";

describe("detectStripoKind", () => {
  it("returns editor when esd-stripe is a class attribute", () => {
    expect(detectStripoKind('<td class="esd-stripe es-p10">x</td>')).toBe(
      "editor",
    );
  });

  it("returns editor for an esd-block-* class", () => {
    expect(detectStripoKind('<td class="esd-block-button">x</td>')).toBe(
      "editor",
    );
  });

  it("returns compiled for es-wrapper without esd-* on elements", () => {
    expect(
      detectStripoKind('<table class="es-wrapper"><tr><td>x</td></tr></table>'),
    ).toBe("compiled");
  });

  it("returns compiled for es-content-body", () => {
    expect(detectStripoKind('<table class="es-content-body">x</table>')).toBe(
      "compiled",
    );
  });

  it("prefers editor when both esd-* and es-wrapper are present", () => {
    expect(
      detectStripoKind(
        '<table class="es-wrapper"><td class="esd-stripe">x</td></table>',
      ),
    ).toBe("editor");
  });

  it("ignores esd-* that only appear inside a stylesheet", () => {
    const html = `<html><head><style>.esd-block-html table { width:auto }</style></head><body><table><tr><td>plain</td></tr></table></body></html>`;
    expect(detectStripoKind(html)).toBe(null);
    expect(isStripoHtml(html)).toBe(false);
  });

  it("returns null for generic table HTML", () => {
    expect(isStripoHtml("<table><tr><td>Hello</td></tr></table>")).toBe(false);
    expect(detectStripoKind("<table><tr><td>Hello</td></tr></table>")).toBe(
      null,
    );
  });

  it("returns null for empty or whitespace", () => {
    expect(detectStripoKind("")).toBe(null);
    expect(detectStripoKind("   ")).toBe(null);
  });
});
