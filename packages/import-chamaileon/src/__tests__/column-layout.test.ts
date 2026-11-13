import { describe, expect, it } from "vitest";
import { columnPixels, matchColumnLayout } from "../column-layout";

describe("matchColumnLayout", () => {
  it("reads 300/300 as 2", () => {
    expect(matchColumnLayout([300, 300])).toEqual({ layout: "2", exact: true });
  });
  it("reads no columns and one column as an exact 1", () => {
    expect(matchColumnLayout([])).toEqual({ layout: "1", exact: true });
    expect(matchColumnLayout([300])).toEqual({ layout: "1", exact: true });
  });
  it("matches the four new layouts exactly", () => {
    expect(matchColumnLayout([150, 150, 150, 150])).toEqual({
      layout: "4",
      exact: true,
    });
    expect(matchColumnLayout([150, 450])).toEqual({
      layout: "1-3",
      exact: true,
    });
    expect(matchColumnLayout([450, 150])).toEqual({
      layout: "3-1",
      exact: true,
    });
    expect(matchColumnLayout([150, 300, 150])).toEqual({
      layout: "1-2-1",
      exact: true,
    });
  });

  // Content padding and spacers sit outside the columns, so 280 / 280 in a
  // padded 600px row is still an even split.
  it("reads shares against the row's own widths, not the body", () => {
    expect(matchColumnLayout([280, 280])).toEqual({ layout: "2", exact: true });
    expect(matchColumnLayout([190, 390])).toEqual({
      layout: "1-2",
      exact: true,
    });
  });

  it("keeps a ratio no preset fits as column widths on the even layout", () => {
    expect(matchColumnLayout([360, 240])).toEqual({
      layout: "2",
      exact: true,
      columnWidths: [60, 40],
    });
    expect(matchColumnLayout([120, 360, 120])).toEqual({
      layout: "3",
      exact: true,
      columnWidths: [20, 60, 20],
    });
    expect(matchColumnLayout([60, 120, 180, 240])).toEqual({
      layout: "4",
      exact: true,
      columnWidths: [10, 20, 30, 40],
    });
  });

  it("gives an unset width Chamaileon's default 300px", () => {
    expect(matchColumnLayout([undefined, 150])).toEqual({
      layout: "2-1",
      exact: true,
    });
    expect(matchColumnLayout([undefined, undefined])).toEqual({
      layout: "2",
      exact: true,
    });
  });

  it("keeps the even layout when a width is not above 0", () => {
    expect(matchColumnLayout([0, 300])).toEqual({ layout: "2", exact: false });
  });

  it("folds five or more columns onto 4, inexact", () => {
    expect(matchColumnLayout([100, 100, 100, 100, 100, 100])).toEqual({
      layout: "4",
      exact: false,
    });
    expect(
      matchColumnLayout([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ]),
    ).toEqual({ layout: "4", exact: false });
  });
});

describe("columnPixels", () => {
  it("splits a 600px body into the 1-3, 3-1, 1-2-1 and 4 tables", () => {
    expect(columnPixels("1-3", 600)).toEqual([150, 450]);
    expect(columnPixels("3-1", 600)).toEqual([450, 150]);
    expect(columnPixels("1-2-1", 600)).toEqual([150, 300, 150]);
    expect(columnPixels("4", 600)).toEqual([150, 150, 150, 150]);
  });

  it("splits the body by column widths when the section has them", () => {
    expect(columnPixels("2", 600, [60, 40])).toEqual([360, 240]);
  });
});
