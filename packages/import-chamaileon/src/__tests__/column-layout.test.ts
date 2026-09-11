import { describe, expect, it } from "vitest";
import { matchColumnLayout, widthsToPercents } from "../column-layout";

describe("widthsToPercents", () => {
  it("converts 300/300 in a 600 body to 50/50", () => {
    expect(widthsToPercents([300, 300], 600)).toEqual([50, 50]);
  });
  it("converts 360/240 to 60/40", () => {
    expect(widthsToPercents([360, 240], 600)).toEqual([60, 40]);
  });
  it("passes through an unset column as null", () => {
    expect(widthsToPercents([300, undefined], 600)).toEqual([50, null]);
  });
});

describe("matchColumnLayout", () => {
  it("matches 50/50 as 2", () => {
    expect(matchColumnLayout([50, 50])).toEqual({ layout: "2", exact: true });
  });
  it("matches 100 as 1", () => {
    expect(matchColumnLayout([100])).toEqual({ layout: "1", exact: true });
  });
  it("folds four equal columns to 3, inexact", () => {
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "3",
      exact: false,
    });
  });
  it("folds six columns to 3, inexact", () => {
    expect(
      matchColumnLayout([16.67, 16.67, 16.67, 16.67, 16.67, 16.67]).layout,
    ).toBe("3");
    expect(
      matchColumnLayout([16.67, 16.67, 16.67, 16.67, 16.67, 16.67]).exact,
    ).toBe(false);
  });
  it("does not call 60/40 an exact 2-1", () => {
    const r = matchColumnLayout([60, 40]);
    expect(r.exact).toBe(false);
  });
  it("distributes all-unset two columns as exact 2", () => {
    expect(matchColumnLayout([null, null])).toEqual({
      layout: "2",
      exact: true,
    });
  });
});
