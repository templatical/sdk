import { describe, expect, it } from "vitest";
import { readGlobalStyle, selectorDefault, tagDefault } from "../global-style";
import type { TopolDesign, TopolNode } from "../types";

const design = (attributes: Record<string, unknown>): TopolDesign =>
  ({ tagName: "mj-global-style", attributes }) as TopolDesign;

const container = (attributes: Record<string, unknown> = {}): TopolNode =>
  ({ tagName: "mj-container", attributes }) as TopolNode;

function read(attrs: Record<string, unknown>, cont = container()) {
  const warnings: string[] = [];
  return { style: readGlobalStyle(design(attrs), cont, warnings), warnings };
}

describe("settings", () => {
  it("defaults every setting for a bare design", () => {
    const { style, warnings } = read({});
    expect(style.settings.width).toBe(600);
    expect(style.settings.backgroundColor).toBe("#ffffff");
    expect(style.settings.textColor).toBe("#1a1a1a");
    expect(style.settings.fontFamily).toBe("Arial");
    expect(warnings).toEqual([]);
  });

  it("reads width from containerWidth", () => {
    expect(read({ containerWidth: 640 }).style.settings.width).toBe(640);
  });

  it("reads the background colour from the container, not the root", () => {
    const { style } = read({}, container({ "background-color": "#f4f4f4" }));
    expect(style.settings.backgroundColor).toBe("#f4f4f4");
  });

  it("defaults the background colour when no mj-container is found at all", () => {
    const style = readGlobalStyle(design({}), undefined, []);
    expect(style.settings.backgroundColor).toBe("#ffffff");
  });

  it("reads the document text colour and font from the bare selector", () => {
    const { style } = read({
      ":color": "#222222",
      ":font-family": "Ubuntu, Helvetica, Arial, sans-serif",
    });
    expect(style.settings.textColor).toBe("#222222");
    expect(style.settings.fontFamily).toBe("Ubuntu");
  });

  it("falls back to the fonts list when no bare font-family is set", () => {
    expect(
      read({ fonts: "Helvetica,sans-serif,Ubuntu" }).style.settings.fontFamily,
    ).toBe("Helvetica");
  });

  it("reads linkColor from the anchor selector", () => {
    expect(read({ "a:color": "#24bfbc" }).style.settings.linkColor).toBe(
      "#24bfbc",
    );
  });

  it("omits linkColor entirely when no anchor colour is set", () => {
    expect("linkColor" in read({}).style.settings).toBe(false);
  });

  it("omits preheaderText, which Topol does not express", () => {
    expect("preheaderText" in read({}).style.settings).toBe(false);
  });

  it("warns once about line-height, which has no settings home", () => {
    expect(read({ ":line-height": 1.5 }).warnings).toEqual([
      "Dropped the document line-height (1.5) — Templatical has no document-level line-height setting.",
    ]);
  });
});

describe("the per-tag and per-selector cascade", () => {
  const attrs = {
    "mj-text": { "line-height": 1.5, "font-size": 15 },
    "mj-button": { "border-radius": "4px" },
    "h1:color": "#111111",
    "h1:font-family": "Helvetica, sans-serif",
    "button:background-color": "#e85034",
  };

  it("exposes a per-tag default", () => {
    expect(tagDefault(read(attrs).style, "mj-text", "font-size")).toBe("15");
  });

  it("returns undefined for a tag default that is not set", () => {
    expect(tagDefault(read(attrs).style, "mj-text", "color")).toBeUndefined();
  });

  it("exposes a per-selector default", () => {
    expect(selectorDefault(read(attrs).style, "h1", "color")).toBe("#111111");
  });

  it("exposes the button selector default", () => {
    expect(
      selectorDefault(read(attrs).style, "button", "background-color"),
    ).toBe("#e85034");
  });

  it("keeps the bare selector separate from the h1 selector", () => {
    const { style } = read({ ":color": "#000000", "h1:color": "#111111" });
    expect(selectorDefault(style, "", "color")).toBe("#000000");
    expect(selectorDefault(style, "h1", "color")).toBe("#111111");
  });
});
