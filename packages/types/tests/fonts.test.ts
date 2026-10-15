import { describe, expect, it } from "vitest";
import {
  BUILT_IN_FONT_STACKS,
  canonicalFontStack,
  firstFontFamily,
  isGenericFontFamily,
  normalizeFontStack,
  parseFontFamilies,
  quoteFontFamily,
} from "../src";

describe("parseFontFamilies", () => {
  it("splits a stack and records which families were quoted", () => {
    expect(
      parseFontFamilies(`"Helvetica Neue", 'Open Sans', Arial, sans-serif`),
    ).toEqual([
      { name: "Helvetica Neue", quoted: true },
      { name: "Open Sans", quoted: true },
      { name: "Arial", quoted: false },
      { name: "sans-serif", quoted: false },
    ]);
  });

  it("keeps a comma inside quotes as part of one family", () => {
    expect(parseFontFamilies(`"Foo, Bar", serif`)).toEqual([
      { name: "Foo, Bar", quoted: true },
      { name: "serif", quoted: false },
    ]);
  });

  it("collapses whitespace inside an unquoted name and resolves escapes in a quoted one", () => {
    expect(parseFontFamilies("  Trebuchet   MS ,Arial")).toEqual([
      { name: "Trebuchet MS", quoted: false },
      { name: "Arial", quoted: false },
    ]);
    expect(parseFontFamilies(`'O\\'Neil Sans'`)).toEqual([
      { name: "O'Neil Sans", quoted: true },
    ]);
  });

  it("ignores a trailing !important", () => {
    expect(parseFontFamilies("Arial ! important")).toEqual([
      { name: "Arial", quoted: false },
    ]);
  });

  it.each([
    [undefined],
    [null],
    [42],
    [""],
    ["   "],
    ["inherit"],
    ["INITIAL"],
    ["unset !important"],
    ["revert-layer"],
    ["inherit, Arial"],
    ["Arial,,sans-serif"],
    ["Arial, sans-serif,"],
    [`"Unclosed, Arial`],
    [`"Foo" bar, Arial`],
  ])("treats %j as no font", (value) => {
    expect(parseFontFamilies(value)).toEqual([]);
  });
});

describe("quoteFontFamily / normalizeFontStack", () => {
  it("re-quotes every quoted family with single quotes and leaves unquoted ones", () => {
    expect(normalizeFontStack(`"Helvetica Neue", Arial,sans-serif`)).toBe(
      "'Helvetica Neue', Arial, sans-serif",
    );
  });

  it("escapes a single quote and backslash inside a name", () => {
    expect(quoteFontFamily("O'Neil\\Sans")).toBe("'O\\'Neil\\\\Sans'");
    expect(normalizeFontStack(`"O'Neil Sans", serif`)).toBe(
      "'O\\'Neil Sans', serif",
    );
  });

  it("never emits a double quote", () => {
    expect(normalizeFontStack(`"A", "B", C`)).toBe("'A', 'B', C");
  });

  it("returns an empty string for no font", () => {
    expect(normalizeFontStack("inherit")).toBe("");
    expect(normalizeFontStack(undefined)).toBe("");
  });
});

describe("firstFontFamily", () => {
  it("returns the first family's name without quotes", () => {
    expect(firstFontFamily(`"Helvetica Neue", Arial`)).toBe("Helvetica Neue");
    expect(firstFontFamily(`"Foo, Bar", serif`)).toBe("Foo, Bar");
    expect(firstFontFamily("inherit, Arial")).toBe("");
  });
});

describe("isGenericFontFamily", () => {
  it("is true only for an unquoted generic keyword", () => {
    expect(isGenericFontFamily({ name: "sans-serif", quoted: false })).toBe(
      true,
    );
    expect(isGenericFontFamily({ name: "SYSTEM-UI", quoted: false })).toBe(
      true,
    );
    expect(isGenericFontFamily({ name: "serif", quoted: true })).toBe(false);
    expect(isGenericFontFamily({ name: "Arial", quoted: false })).toBe(false);
  });
});

describe("canonicalFontStack", () => {
  it.each(Object.entries(BUILT_IN_FONT_STACKS))(
    "collapses %s's own renderer stack to the bare name",
    (_, stack) => {
      expect(canonicalFontStack(stack)).toBe(firstFontFamily(stack));
    },
  );

  it("collapses case and quoting variants of a built-in stack", () => {
    expect(canonicalFontStack("arial, SANS-SERIF")).toBe("Arial");
    expect(canonicalFontStack(`"Times New Roman", serif`)).toBe(
      "Times New Roman",
    );
    expect(canonicalFontStack("Times New Roman, serif")).toBe(
      "Times New Roman",
    );
  });

  it("collapses a lone built-in to its canonical name", () => {
    expect(canonicalFontStack("'arial'")).toBe("Arial");
    expect(canonicalFontStack("courier new")).toBe("Courier New");
  });

  it("keeps any stack that isn't exactly a built-in's", () => {
    expect(canonicalFontStack("Arial, Helvetica, sans-serif")).toBe(
      "Arial, Helvetica, sans-serif",
    );
    expect(canonicalFontStack("Helvetica, Arial, sans-serif")).toBe(
      "Helvetica, Arial, sans-serif",
    );
    expect(canonicalFontStack("'Inter', Arial, sans-serif")).toBe(
      "'Inter', Arial, sans-serif",
    );
    expect(canonicalFontStack("Arial, 'sans-serif'")).toBe(
      "Arial, 'sans-serif'",
    );
  });

  it("keeps a lone unknown family as written", () => {
    expect(canonicalFontStack("Montserrat")).toBe("Montserrat");
  });

  it("returns an empty string for no font", () => {
    expect(canonicalFontStack("inherit")).toBe("");
    expect(canonicalFontStack("")).toBe("");
  });
});
