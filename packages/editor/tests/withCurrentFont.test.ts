import { describe, expect, it } from "vitest";
import { fontSelectValue, withCurrentFont } from "../src/utils/withCurrentFont";

const FONTS = [
  { label: "Arial", value: "Arial" },
  { label: "Helvetica", value: "Helvetica" },
];

describe("withCurrentFont", () => {
  it("lists an unlisted stack first, labelled by its first family", () => {
    const stack = "Helvetica Neue, Helvetica, Arial, sans-serif";
    expect(withCurrentFont(FONTS, stack)).toEqual([
      { value: stack, label: "Helvetica Neue" },
      ...FONTS,
    ]);
  });

  it("drops the quotes around a quoted first family", () => {
    const stack = "'Open Sans', Arial, sans-serif";
    expect(withCurrentFont(FONTS, stack)[0]).toEqual({
      value: stack,
      label: "Open Sans",
    });
  });

  it("hands a listed family's option to a stack that starts with it", () => {
    for (const stack of ["Arial, sans-serif", "arial", "'Helvetica', Arial"]) {
      const options = withCurrentFont(FONTS, stack);
      expect(options).toHaveLength(FONTS.length);
      expect(options.find((o) => o.value === stack)?.label).toBe(
        stack.toLowerCase().includes("helvetica") ? "Helvetica" : "Arial",
      );
    }
  });

  it("strips !important from the label but keeps the value", () => {
    const value = "Helvetica Neue, Arial !important";
    expect(withCurrentFont(FONTS, value)[0]).toEqual({
      value,
      label: "Helvetica Neue",
    });
    expect(withCurrentFont(FONTS, "Arial !important")).toEqual([
      { label: "Arial", value: "Arial !important" },
      FONTS[1],
    ]);
  });

  it("strips !important written with a space", () => {
    expect(withCurrentFont(FONTS, "Arial ! important")).toEqual([
      { label: "Arial", value: "Arial ! important" },
      FONTS[1],
    ]);
  });

  it("matches a family against an option's value as well as its label", () => {
    const fonts = [{ label: "Brand sans", value: "Inter" }];
    expect(withCurrentFont(fonts, "Inter, sans-serif")).toEqual([
      { label: "Brand sans", value: "Inter, sans-serif" },
    ]);
  });

  it("treats CSS-wide keywords and blank values as no font", () => {
    for (const value of ["inherit", "INITIAL", "unset", "revert", "   "]) {
      expect(withCurrentFont(FONTS, value)).toBe(FONTS);
    }
    expect(withCurrentFont(FONTS, "inherit !important")).toBe(FONTS);
  });

  it("returns the list unchanged for a listed font or none", () => {
    expect(withCurrentFont(FONTS, "Arial")).toBe(FONTS);
    expect(withCurrentFont(FONTS, "")).toBe(FONTS);
    expect(withCurrentFont(FONTS, undefined)).toBe(FONTS);
  });
});

describe("fontSelectValue", () => {
  it("binds CSS-wide keywords and blank values as the placeholder", () => {
    for (const value of [undefined, "", "  ", "inherit", "Unset !important"]) {
      expect(fontSelectValue(value)).toBe("");
    }
  });

  it("binds any other value unchanged", () => {
    expect(fontSelectValue("Georgia, serif")).toBe("Georgia, serif");
    expect(fontSelectValue("Arial !important")).toBe("Arial !important");
  });
});
