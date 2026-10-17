import { describe, expect, it } from "vitest";
import { mjmlHorizontalInset } from "../block-base";

/**
 * MJML sizes a box by its side padding and side borders, each read as a whole
 * pixel (`getShorthandAttrValue` / `getShorthandBorderValue` in mjml-core).
 */
describe("mjmlHorizontalInset", () => {
  it("is 0 with no padding or border", () => {
    expect(mjmlHorizontalInset({})).toBe(0);
  });

  it.each([
    ["one value", "20.5px", 40],
    ["two values", "10px 20.5px", 40],
    ["three values", "10px 20.5px 5px", 40],
    ["four values", "0 12.9px 0 30.5px", 42],
  ])(
    "reads the padding shorthand's sides as whole pixels (%s)",
    (_name, padding, inset) => {
      expect(mjmlHorizontalInset({ padding })).toBe(inset);
    },
  );

  it("lets padding-left / -right override the shorthand", () => {
    expect(
      mjmlHorizontalInset({ padding: "10px", "padding-left": "25.7px" }),
    ).toBe(35);
  });

  it("reads a border's width as a whole pixel on each side", () => {
    expect(mjmlHorizontalInset({ border: "2.5px solid #000000" })).toBe(4);
  });

  it("lets border-left / -right override border", () => {
    expect(
      mjmlHorizontalInset({
        border: "3px solid #ff0000",
        "border-left": "1.5px dashed #0000ff",
      }),
    ).toBe(4);
  });

  it("adds padding and border together", () => {
    expect(
      mjmlHorizontalInset({
        padding: "0 25px",
        border: "3px solid #000000",
      }),
    ).toBe(56);
  });

  it.each([
    ["border none", { border: "none" }],
    ["unparseable padding", { padding: "auto" }],
  ])("is 0 for %s", (_name, attrs) => {
    expect(mjmlHorizontalInset(attrs)).toBe(0);
  });
});
