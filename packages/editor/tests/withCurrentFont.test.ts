import { describe, expect, it } from "vitest";
import { withCurrentFont } from "../src/utils/withCurrentFont";

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

  it("labels the stack in full when its first family is already listed", () => {
    expect(withCurrentFont(FONTS, "Arial, sans-serif")[0]).toEqual({
      value: "Arial, sans-serif",
      label: "Arial, sans-serif",
    });
    expect(withCurrentFont(FONTS, "arial")[0]).toEqual({
      value: "arial",
      label: "arial",
    });
  });

  it("returns the list unchanged for a listed font or none", () => {
    expect(withCurrentFont(FONTS, "Arial")).toBe(FONTS);
    expect(withCurrentFont(FONTS, "")).toBe(FONTS);
    expect(withCurrentFont(FONTS, undefined)).toBe(FONTS);
  });
});
