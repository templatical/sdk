import { describe, expect, it } from "vitest";
import {
  columnPixels,
  COLUMN_COUNT,
  matchColumnLayout,
  widthsToPercents,
} from "../column-layout";

describe("matchColumnLayout", () => {
  it("matches 50/50", () => {
    expect(matchColumnLayout([50, 50])).toEqual({ layout: "2", exact: true });
  });

  it("matches 33.33/33.33/33.34", () => {
    expect(matchColumnLayout([33.33, 33.33, 33.34])).toEqual({
      layout: "3",
      exact: true,
    });
  });

  it("treats all-unset 3-col as exact 3", () => {
    expect(matchColumnLayout([null, null, null])).toEqual({
      layout: "3",
      exact: true,
    });
  });

  it("matches four equal columns exactly", () => {
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "4",
      exact: true,
    });
  });

  it("treats an empty list and all-unset 1/2/4 as exact, and 5 as inexact 4", () => {
    expect(matchColumnLayout([])).toEqual({ layout: "1", exact: true });
    expect(matchColumnLayout([null])).toEqual({ layout: "1", exact: true });
    expect(matchColumnLayout([null, null])).toEqual({
      layout: "2",
      exact: true,
    });
    expect(matchColumnLayout([null, null, null, null])).toEqual({
      layout: "4",
      exact: true,
    });
    expect(matchColumnLayout([null, null, null, null, null])).toEqual({
      layout: "4",
      exact: false,
    });
  });

  it("matches the new layouts and a near 1-2-1", () => {
    expect(matchColumnLayout([25, 75])).toEqual({ layout: "1-3", exact: true });
    expect(matchColumnLayout([75, 25])).toEqual({ layout: "3-1", exact: true });
    expect(matchColumnLayout([25, 50, 25])).toEqual({
      layout: "1-2-1",
      exact: true,
    });
    expect(matchColumnLayout([24, 51, 25])).toEqual({
      layout: "1-2-1",
      exact: true,
    });
  });

  it("keeps a ratio no preset fits as column widths on the even layout", () => {
    expect(matchColumnLayout([20, 60, 20])).toEqual({
      layout: "3",
      exact: true,
      columnWidths: [20, 60, 20],
    });
    expect(matchColumnLayout([40, 60])).toEqual({
      layout: "2",
      exact: true,
      columnWidths: [40, 60],
    });
    expect(matchColumnLayout([10, 20, 30, 40])).toEqual({
      layout: "4",
      exact: true,
      columnWidths: [10, 20, 30, 40],
    });
  });

  it("scales widths that do not total 100 and reports them inexact", () => {
    expect(matchColumnLayout([30, 40])).toEqual({
      layout: "2",
      exact: false,
      columnWidths: [42.86, 57.14],
    });
  });

  it("keeps the preset scaled widths land on, without column widths", () => {
    expect(matchColumnLayout([45, 45])).toEqual({ layout: "2", exact: false });
    expect(matchColumnLayout([30, 60])).toEqual({
      layout: "1-2",
      exact: false,
    });
  });

  it("keeps the even layout when a width is not above 0", () => {
    expect(matchColumnLayout([0, 100])).toEqual({ layout: "2", exact: false });
  });

  it("approximates a single column narrower than the section", () => {
    expect(matchColumnLayout([50])).toEqual({ layout: "1", exact: false });
  });

  it("matches 1, 1-2 and 2-1, and gives an unset width an equal share", () => {
    expect(matchColumnLayout([100])).toEqual({ layout: "1", exact: true });
    expect(matchColumnLayout([33.33, 66.67])).toEqual({
      layout: "1-2",
      exact: true,
    });
    expect(matchColumnLayout([66.67, 33.33])).toEqual({
      layout: "2-1",
      exact: true,
    });
    // MJML gives an absent width half the row, not the 66.67 left over.
    expect(matchColumnLayout([33.33, null])).toEqual({
      layout: "2",
      exact: false,
      columnWidths: [40, 60],
    });
  });

  it("splits pixels for each layout and converts widths to percents", () => {
    expect(columnPixels("1", 600)).toEqual([600]);
    expect(columnPixels("2", 600)).toEqual([300, 300]);
    expect(columnPixels("3", 600)).toEqual([200, 200, 200]);
    expect(columnPixels("1-2", 600)).toEqual([200, 400]);
    expect(columnPixels("2-1", 600)).toEqual([400, 200]);
    expect(columnPixels("4", 600)).toEqual([150, 150, 150, 150]);
    expect(columnPixels("1-3", 600)).toEqual([150, 450]);
    expect(columnPixels("3-1", 600)).toEqual([450, 150]);
    expect(columnPixels("1-2-1", 600)).toEqual([150, 300, 150]);
    expect(columnPixels("2", 600, [40, 60])).toEqual([240, 360]);
    expect(COLUMN_COUNT["1-2"]).toBe(2);
    expect(COLUMN_COUNT["4"]).toBe(4);
    expect(COLUMN_COUNT["1-2-1"]).toBe(3);
    expect(widthsToPercents([300, undefined], 600)).toEqual([50, null]);
  });
});
