import "./dom-stubs";

import { describe, expect, it } from "vitest";

import { FontSize } from "../src/extensions/FontSize";
import { LetterSpacing } from "../src/extensions/LetterSpacing";
import { LineHeight } from "../src/extensions/LineHeight";

/**
 * Helper to extract the global attribute config from a TipTap extension.
 * Calls addGlobalAttributes() with the extension's options as `this` context,
 * then returns the first attribute entry from the first global-attribute group.
 */
function getGlobalAttr(ext: any, attrName: string) {
  const configured = ext.configure({});
  // addGlobalAttributes is stored on the extension config
  const addGlobalAttributes =
    configured.config?.addGlobalAttributes ?? ext.config?.addGlobalAttributes;
  // Call with the correct `this` so this.options resolves
  const groups = addGlobalAttributes.call({
    options: configured.options,
  });
  const group = groups[0];
  return { types: group.types, attr: group.attributes[attrName] };
}

describe("FontSize extension", () => {
  const ext = FontSize.configure({});

  it("has correct name", () => {
    expect(ext.name).toBe("fontSize");
  });

  it("has default types option", () => {
    expect(ext.options.types).toEqual(["textStyle"]);
  });

  it("accepts custom types option", () => {
    const custom = FontSize.configure({ types: ["heading", "textStyle"] });
    expect(custom.options.types).toEqual(["heading", "textStyle"]);
  });

  describe("fontSize global attribute", () => {
    const { types, attr } = getGlobalAttr(FontSize, "fontSize");

    it("applies to types from options", () => {
      expect(types).toEqual(["textStyle"]);
    });

    it("has null as default value", () => {
      expect(attr.default).toBeNull();
    });

    it("parseHTML extracts fontSize from element style", () => {
      const element = { style: { fontSize: "16px" } } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("16px");
    });

    it("parseHTML extracts rem values", () => {
      const element = {
        style: { fontSize: "1.2rem" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("1.2rem");
    });

    it("parseHTML strips quotes from fontSize value", () => {
      const element = {
        style: { fontSize: "'14px'" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("14px");
    });

    it("parseHTML strips double quotes from fontSize value", () => {
      const element = {
        style: { fontSize: '"18px"' },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("18px");
    });

    it("parseHTML returns null for empty fontSize", () => {
      const element = { style: { fontSize: "" } } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBeNull();
    });

    it("parseHTML returns null for missing fontSize", () => {
      const element = { style: {} } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBeNull();
    });

    it("renderHTML returns font-size style for valid value", () => {
      const result = attr.renderHTML({ fontSize: "18px" });
      expect(result).toEqual({ style: "font-size: 18px" });
    });

    it("renderHTML returns font-size style for rem value", () => {
      const result = attr.renderHTML({ fontSize: "1.5rem" });
      expect(result).toEqual({ style: "font-size: 1.5rem" });
    });

    it("renderHTML returns empty object for null fontSize", () => {
      const result = attr.renderHTML({ fontSize: null });
      expect(result).toEqual({});
    });

    it("renderHTML returns empty object for undefined fontSize", () => {
      const result = attr.renderHTML({});
      expect(result).toEqual({});
    });
  });
});

describe("LetterSpacing extension", () => {
  const ext = LetterSpacing.configure({});

  it("has correct name", () => {
    expect(ext.name).toBe("letterSpacing");
  });

  it("has default types option", () => {
    expect(ext.options.types).toEqual(["textStyle"]);
  });

  it("accepts custom types option", () => {
    const custom = LetterSpacing.configure({ types: ["paragraph"] });
    expect(custom.options.types).toEqual(["paragraph"]);
  });

  describe("letterSpacing global attribute", () => {
    const { types, attr } = getGlobalAttr(LetterSpacing, "letterSpacing");

    it("applies to types from options", () => {
      expect(types).toEqual(["textStyle"]);
    });

    it("has null as default value", () => {
      expect(attr.default).toBeNull();
    });

    it("parseHTML extracts letterSpacing from element style", () => {
      const element = {
        style: { letterSpacing: "2px" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("2px");
    });

    it("parseHTML extracts em values", () => {
      const element = {
        style: { letterSpacing: "0.05em" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("0.05em");
    });

    it("parseHTML strips quotes from letterSpacing value", () => {
      const element = {
        style: { letterSpacing: "'1px'" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("1px");
    });

    it("parseHTML strips double quotes from letterSpacing value", () => {
      const element = {
        style: { letterSpacing: '"3px"' },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("3px");
    });

    it("parseHTML returns null for empty letterSpacing", () => {
      const element = {
        style: { letterSpacing: "" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBeNull();
    });

    it("parseHTML returns null for missing letterSpacing", () => {
      const element = { style: {} } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBeNull();
    });

    it("renderHTML returns letter-spacing style for valid value", () => {
      const result = attr.renderHTML({ letterSpacing: "2px" });
      expect(result).toEqual({ style: "letter-spacing: 2px" });
    });

    it("renderHTML returns letter-spacing style for em value", () => {
      const result = attr.renderHTML({ letterSpacing: "0.1em" });
      expect(result).toEqual({ style: "letter-spacing: 0.1em" });
    });

    it("renderHTML returns empty object for null letterSpacing", () => {
      const result = attr.renderHTML({ letterSpacing: null });
      expect(result).toEqual({});
    });

    it("renderHTML returns empty object for undefined letterSpacing", () => {
      const result = attr.renderHTML({});
      expect(result).toEqual({});
    });
  });
});

describe("LineHeight extension", () => {
  const ext = LineHeight.configure({});

  it("has correct name", () => {
    expect(ext.name).toBe("lineHeight");
  });

  it("has default types option", () => {
    expect(ext.options.types).toEqual(["paragraph"]);
  });

  it("has default defaultLineHeight option", () => {
    expect(ext.options.defaultLineHeight).toBe("1.5");
  });

  it("accepts custom types option", () => {
    const custom = LineHeight.configure({ types: ["heading", "paragraph"] });
    expect(custom.options.types).toEqual(["heading", "paragraph"]);
  });

  it("accepts custom defaultLineHeight option", () => {
    const custom = LineHeight.configure({ defaultLineHeight: "2.0" });
    expect(custom.options.defaultLineHeight).toBe("2.0");
  });

  describe("lineHeight global attribute", () => {
    const { types, attr } = getGlobalAttr(LineHeight, "lineHeight");

    it("applies to types from options", () => {
      expect(types).toEqual(["paragraph"]);
    });

    it("has null as default value", () => {
      expect(attr.default).toBeNull();
    });

    it("parseHTML extracts lineHeight from element style", () => {
      const element = {
        style: { lineHeight: "1.8" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("1.8");
    });

    it("parseHTML extracts pixel lineHeight", () => {
      const element = {
        style: { lineHeight: "24px" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("24px");
    });

    it("parseHTML does not strip quotes (unlike FontSize/LetterSpacing)", () => {
      // LineHeight implementation uses || null without .replace()
      const element = {
        style: { lineHeight: "normal" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBe("normal");
    });

    it("parseHTML returns null for empty lineHeight", () => {
      const element = {
        style: { lineHeight: "" },
      } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBeNull();
    });

    it("parseHTML returns null for missing lineHeight", () => {
      const element = { style: {} } as unknown as HTMLElement;
      expect(attr.parseHTML(element)).toBeNull();
    });

    it("renderHTML returns line-height style for valid value", () => {
      const result = attr.renderHTML({ lineHeight: "1.8" });
      expect(result).toEqual({ style: "line-height: 1.8" });
    });

    it("renderHTML returns line-height style for pixel value", () => {
      const result = attr.renderHTML({ lineHeight: "24px" });
      expect(result).toEqual({ style: "line-height: 24px" });
    });

    it("renderHTML returns empty object for null lineHeight", () => {
      const result = attr.renderHTML({ lineHeight: null });
      expect(result).toEqual({});
    });

    it("renderHTML returns empty object for undefined lineHeight", () => {
      const result = attr.renderHTML({});
      expect(result).toEqual({});
    });
  });
});
