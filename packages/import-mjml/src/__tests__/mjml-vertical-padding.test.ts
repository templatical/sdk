import { describe, expect, it } from "vitest";
import { mjmlVerticalPadding } from "../block-base";

/**
 * MJML sizes a fixed-height hero's cell as its height less the top and bottom
 * padding, each read as a whole pixel (`getShorthandAttrValue` in mjml-core).
 */
describe("mjmlVerticalPadding", () => {
  it("is 0 with no padding", () => {
    expect(mjmlVerticalPadding({})).toBe(0);
  });

  it.each([
    ["one value", "20.5px", 40],
    ["two values", "10.9px 20px", 20],
    ["three values", "10px 20px 5.5px", 15],
    ["four values", "12px 0 30.5px 0", 42],
  ])(
    "reads the padding shorthand's top and bottom as whole pixels (%s)",
    (_name, padding, total) => {
      expect(mjmlVerticalPadding({ padding })).toBe(total);
    },
  );

  it("lets padding-top / -bottom override the shorthand", () => {
    expect(
      mjmlVerticalPadding({ padding: "10px", "padding-bottom": "25.7px" }),
    ).toBe(35);
  });

  it("is 0 for unparseable padding", () => {
    expect(mjmlVerticalPadding({ padding: "auto" })).toBe(0);
  });
});
