import { describe, expect, it } from "vitest";
import { BUTTON_LINE_HEIGHT, buttonLineHeight } from "../src/blocks";

describe("buttonLineHeight", () => {
  it("is the shared 1.2 ratio when the field is omitted", () => {
    expect(BUTTON_LINE_HEIGHT).toBe(1.2);
    expect(buttonLineHeight({})).toBe(1.2);
  });

  it("returns a stored finite ratio above 0", () => {
    expect(buttonLineHeight({ lineHeight: 2 })).toBe(2);
    expect(buttonLineHeight({ lineHeight: 1.25 })).toBe(1.25);
    expect(buttonLineHeight({ lineHeight: 1.75 })).toBe(1.75);
  });

  it("ignores a value that is not a finite number above 0", () => {
    expect(buttonLineHeight({ lineHeight: 0 })).toBe(1.2);
    expect(buttonLineHeight({ lineHeight: -1 })).toBe(1.2);
    expect(buttonLineHeight({ lineHeight: Number.NaN })).toBe(1.2);
    expect(buttonLineHeight({ lineHeight: Number.POSITIVE_INFINITY })).toBe(1.2);
    expect(buttonLineHeight({ lineHeight: Number.NEGATIVE_INFINITY })).toBe(1.2);
    expect(buttonLineHeight({ lineHeight: "2" as unknown as number })).toBe(1.2);
  });
});
