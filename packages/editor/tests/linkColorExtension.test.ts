import { describe, expect, it } from "vitest";
import {
  sanitizeLinkColor,
  withLinkColor,
} from "../src/utils/linkColorExtension";

describe("sanitizeLinkColor", () => {
  it("accepts hex colors (3–8 digits)", () => {
    expect(sanitizeLinkColor("#fff")).toBe("#fff");
    expect(sanitizeLinkColor("#ff6600")).toBe("#ff6600");
    expect(sanitizeLinkColor("#ff660080")).toBe("#ff660080");
  });

  it("accepts rgb/rgba/hsl/hsla", () => {
    expect(sanitizeLinkColor("rgb(255, 102, 0)")).toBe("rgb(255, 102, 0)");
    expect(sanitizeLinkColor("rgba(0,0,0,0.5)")).toBe("rgba(0,0,0,0.5)");
    expect(sanitizeLinkColor("hsl(24, 100%, 50%)")).toBe("hsl(24, 100%, 50%)");
  });

  it("accepts bare keyword colors", () => {
    expect(sanitizeLinkColor("red")).toBe("red");
  });

  it("returns null for empty/nullish input", () => {
    expect(sanitizeLinkColor("")).toBeNull();
    expect(sanitizeLinkColor(null)).toBeNull();
    expect(sanitizeLinkColor(undefined)).toBeNull();
  });

  it("rejects CSS-injection payloads", () => {
    expect(sanitizeLinkColor("red; background: url(//evil)")).toBeNull();
    expect(sanitizeLinkColor('red"')).toBeNull();
    expect(sanitizeLinkColor("url(javascript:alert(1))")).toBeNull();
    expect(sanitizeLinkColor("}#x{color:red")).toBeNull();
  });
});

describe("withLinkColor", () => {
  // Capture the config passed to LinkExt.extend() from a stub base mark, then
  // exercise the `color` attribute's parse/render without booting TipTap.
  function colorAttribute() {
    let config: { addAttributes: () => Record<string, any> } | undefined;
    const stubLink = {
      extend(cfg: { addAttributes: () => Record<string, any> }) {
        config = cfg;
        return {};
      },
    };
    withLinkColor(stubLink as never);
    const attrs = config!.addAttributes.call({
      parent: () => ({ href: { default: null } }),
    });
    return attrs;
  }

  it("preserves base attributes and adds a color attribute", () => {
    const attrs = colorAttribute();
    expect(attrs.href).toBeDefined();
    expect(attrs.color.default).toBeNull();
  });

  it("parses a safe color from the element's inline style", () => {
    const { color } = colorAttribute();
    expect(color.parseHTML({ style: { color: "#ff6600" } })).toBe("#ff6600");
  });

  it("normalizes a browser-serialized rgb() color to hex on parse", () => {
    const { color } = colorAttribute();
    // The browser serializes inline `color:#ff6600` to `rgb(255, 102, 0)`.
    expect(color.parseHTML({ style: { color: "rgb(255, 102, 0)" } })).toBe(
      "#ff6600",
    );
  });

  it("drops an unsafe parsed color", () => {
    const { color } = colorAttribute();
    expect(color.parseHTML({ style: { color: "red;}evil{" } })).toBeNull();
  });

  it("renders a set color as an inline style on the <a>", () => {
    const { color } = colorAttribute();
    expect(color.renderHTML({ color: "#e11d48" })).toEqual({
      style: "color: #e11d48",
    });
  });

  it("renders no style when the color is unset", () => {
    const { color } = colorAttribute();
    expect(color.renderHTML({ color: null })).toEqual({});
  });
});
