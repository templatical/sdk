import { describe, expect, it } from "vitest";
import {
  columnPixels,
  matchColumnLayout,
  widthsToPercents,
} from "../column-layout";

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
  it("matches the four new layouts exactly", () => {
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "4",
      exact: true,
    });
    expect(matchColumnLayout([25, 75])).toEqual({ layout: "1-3", exact: true });
    expect(matchColumnLayout([75, 25])).toEqual({ layout: "3-1", exact: true });
    expect(matchColumnLayout([25, 50, 25])).toEqual({
      layout: "1-2-1",
      exact: true,
    });
  });
  it("snaps 20/60/20 to 1-2-1", () => {
    expect(matchColumnLayout([20, 60, 20])).toEqual({
      layout: "1-2-1",
      exact: false,
    });
  });
  it("folds six columns onto 4, inexact", () => {
    expect(
      matchColumnLayout([16.67, 16.67, 16.67, 16.67, 16.67, 16.67]).layout,
    ).toBe("4");
    expect(
      matchColumnLayout([16.67, 16.67, 16.67, 16.67, 16.67, 16.67]).exact,
    ).toBe(false);
  });
  it("treats four unset columns as an exact 4", () => {
    expect(matchColumnLayout([null, null, null, null])).toEqual({
      layout: "4",
      exact: true,
    });
  });
  it("folds five unset columns onto 4, inexact", () => {
    expect(matchColumnLayout([null, null, null, null, null])).toEqual({
      layout: "4",
      exact: false,
    });
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

describe("columnPixels", () => {
  it("splits a 600px body into the 1-3, 3-1, 1-2-1 and 4 tables", () => {
    expect(columnPixels("1-3", 600)).toEqual([150, 450]);
    expect(columnPixels("3-1", 600)).toEqual([450, 150]);
    expect(columnPixels("1-2-1", 600)).toEqual([150, 300, 150]);
    expect(columnPixels("4", 600)).toEqual([150, 150, 150, 150]);
  });
});
