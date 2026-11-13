import { describe, expect, it } from "vitest";
import { getWidthPercentages } from "@templatical/renderer";
import type { ColumnLayout } from "@templatical/types";
import { readColumnWidth, resolveColumnRatio } from "../column-ratio";
import type { ColumnWidth } from "../column-ratio";

const ALL_LAYOUTS: ColumnLayout[] = [
  "1",
  "2",
  "3",
  "4",
  "1-2",
  "2-1",
  "1-3",
  "3-1",
  "1-2-1",
];

function px(value: number): ColumnWidth {
  return { unit: "px", value };
}

function percent(value: number): ColumnWidth {
  return { unit: "%", value };
}

describe("column-ratio — the snap targets are the renderer's", () => {
  it("snaps a layout's own percentages back to that layout", () => {
    for (const layout of ALL_LAYOUTS) {
      const shares = getWidthPercentages(layout).map((width) => ({
        unit: "px" as const,
        value: parseFloat(width),
      }));
      expect(resolveColumnRatio(shares, layout)).toEqual({ layout });
    }
  });

  it("resolves a renderer percentage to the layout that emitted it", () => {
    // Read the other way round: each two-column layout's own widths must pick
    // it out from the others, so the table cannot be off by a column order
    // (which would swap 1-2 and 2-1 while every symmetric case passed).
    const from = (layout: ColumnLayout) =>
      resolveColumnRatio(
        getWidthPercentages(layout).map((width) => percent(parseFloat(width))),
        "2",
      ).layout;
    expect(from("2")).toBe("2");
    expect(from("1-2")).toBe("1-2");
    expect(from("2-1")).toBe("2-1");
    expect(from("1-3")).toBe("1-3");
    expect(from("3-1")).toBe("3-1");
  });
});

describe("readColumnWidth — signal priority", () => {
  it("prefers an mj-column-per class over every style", () => {
    expect(
      readColumnWidth(
        "mj-column-per-66-67 mj-outlook-group-fix",
        { width: "100%", "max-width": "300px" },
        "300",
      ),
    ).toEqual(percent(66.67));
  });

  it("reads a whole-number mj-column-per class", () => {
    expect(readColumnWidth("mj-column-per-50", {}, undefined)).toEqual(
      percent(50),
    );
  });

  it("reads MJML's fixed-width column class as pixels", () => {
    expect(readColumnWidth("mj-column-px-350", {}, undefined)).toEqual(px(350));
  });

  it("ignores a class that merely starts like a column class", () => {
    expect(
      readColumnWidth("mj-column-per-66-67-alt", { width: "40%" }, undefined),
    ).toEqual(percent(40));
  });

  it("prefers max-width over a width of 100%", () => {
    expect(
      readColumnWidth(
        "stack-column",
        { display: "inline-block", "max-width": "220px", width: "100%" },
        undefined,
      ),
    ).toEqual(px(220));
  });

  it("prefers a style width over the width attribute", () => {
    expect(readColumnWidth(undefined, { width: "40%" }, "350")).toEqual(
      percent(40),
    );
  });

  it("falls back to the width attribute", () => {
    expect(readColumnWidth(undefined, {}, "350")).toEqual(px(350));
    expect(readColumnWidth(undefined, {}, "50%")).toEqual(percent(50));
  });

  it("reads no signal from a width of 100%", () => {
    expect(readColumnWidth(undefined, { width: "100%" }, undefined)).toBe(null);
    expect(readColumnWidth(undefined, {}, "100%")).toBe(null);
  });

  it("keeps a width of 100px, which is a real length", () => {
    expect(readColumnWidth(undefined, { width: "100px" }, undefined)).toEqual(
      px(100),
    );
  });

  it("reads no signal from a non-length width", () => {
    expect(readColumnWidth(undefined, { width: "auto" }, undefined)).toBe(null);
    expect(
      readColumnWidth(undefined, { width: "calc(50% - 10px)" }, undefined),
    ).toBe(null);
    expect(readColumnWidth(undefined, { width: "0" }, undefined)).toBe(null);
    expect(readColumnWidth(undefined, {}, undefined)).toBe(null);
  });
});

describe("resolveColumnRatio — widths choose the layout, never the count", () => {
  it("snaps mailchimp's 350/190 sidebar to 2-1", () => {
    expect(resolveColumnRatio([px(350), px(190)], "2")).toEqual({
      layout: "2-1",
    });
  });

  it("snaps the mirrored 190/350 to 1-2", () => {
    expect(resolveColumnRatio([px(190), px(350)], "2")).toEqual({
      layout: "1-2",
    });
  });

  it("snaps Cerberus's 33.33/66.66 percentages to 1-2", () => {
    expect(resolveColumnRatio([percent(33.33), percent(66.66)], "2")).toEqual({
      layout: "1-2",
    });
  });

  it("snaps Cerberus's 220/440 max-widths to 1-2", () => {
    expect(resolveColumnRatio([px(220), px(440)], "2")).toEqual({
      layout: "1-2",
    });
  });

  it("keeps an equal split as the counted layout with nothing to report", () => {
    const resolved = resolveColumnRatio([px(280), px(280)], "2");
    expect(resolved.layout).toBe("2");
    expect("note" in resolved).toBe(false);
  });

  it("keeps the counted layout when the row declares nothing", () => {
    const resolved = resolveColumnRatio([null, null], "2");
    expect(resolved.layout).toBe("2");
    expect("note" in resolved).toBe(false);
  });

  it("keeps the counted layout for a partial declaration", () => {
    const resolved = resolveColumnRatio([px(350), null], "2");
    expect(resolved.layout).toBe("2");
    expect("note" in resolved).toBe(false);
  });

  it("keeps the counted layout for widths in mixed units", () => {
    const resolved = resolveColumnRatio([px(350), percent(50)], "2");
    expect(resolved.layout).toBe("2");
    expect("note" in resolved).toBe(false);
  });

  it("reads 25/75, 75/25, 25/50/25 and four quarters as those layouts", () => {
    expect(resolveColumnRatio([percent(25), percent(75)], "2")).toEqual({
      layout: "1-3",
    });
    expect(resolveColumnRatio([percent(75), percent(25)], "2")).toEqual({
      layout: "3-1",
    });
    expect(
      resolveColumnRatio([percent(25), percent(50), percent(25)], "3"),
    ).toEqual({ layout: "1-2-1" });
    expect(
      resolveColumnRatio(
        [percent(25), percent(25), percent(25), percent(25)],
        "4",
      ),
    ).toEqual({ layout: "4" });
  });

  it("snaps 76/24 onto 3-1, inside the tolerance", () => {
    expect(resolveColumnRatio([percent(76), percent(24)], "2")).toEqual({
      layout: "3-1",
    });
  });

  it("keeps 72/28 as column widths, three points from 3-1", () => {
    expect(resolveColumnRatio([percent(72), percent(28)], "2")).toEqual({
      layout: "2",
      columnWidths: [72, 28],
    });
  });

  it("keeps a 90/10 ratio as column widths on the counted layout", () => {
    expect(resolveColumnRatio([percent(90), percent(10)], "2")).toEqual({
      layout: "2",
      columnWidths: [90, 10],
    });
  });

  it("keeps px shares of the declared total, not of the row", () => {
    expect(resolveColumnRatio([px(200), px(300)], "2")).toEqual({
      layout: "2",
      columnWidths: [40, 60],
    });
  });

  it("reads 130/280/130 as 1-2-1", () => {
    expect(resolveColumnRatio([px(130), px(280), px(130)], "3")).toEqual({
      layout: "1-2-1",
    });
  });

  it("keeps a 10/80/10 ratio, which no three-column layout is within tolerance of", () => {
    expect(
      resolveColumnRatio([percent(10), percent(80), percent(10)], "3"),
    ).toEqual({
      layout: "3",
      columnWidths: [10, 80, 10],
    });
  });

  it("keeps an unequal four-column ratio on layout 4", () => {
    expect(
      resolveColumnRatio([px(60), px(120), px(180), px(240)], "4"),
    ).toEqual({
      layout: "4",
      columnWidths: [10, 20, 30, 40],
    });
  });

  it("keeps equal thirds as 3 with nothing to report", () => {
    const resolved = resolveColumnRatio(
      [percent(33.33), percent(33.33), percent(33.33)],
      "3",
    );
    expect(resolved.layout).toBe("3");
    expect("note" in resolved).toBe(false);
  });

  it("holds the tolerance either side of the widest real match", () => {
    // 64.8 / 35.2 is 1.9pp from 2-1 and matches. These two pin the band: a
    // 1.67pp-off ratio still snaps, and a 2.67pp-off one keeps its shares.
    expect(resolveColumnRatio([percent(65), percent(35)], "2")).toEqual({
      layout: "2-1",
    });
    expect(resolveColumnRatio([percent(64), percent(36)], "2")).toEqual({
      layout: "2",
      columnWidths: [64, 36],
    });
  });

  it("never returns a layout of a different column count", () => {
    // The count is settled before widths are read. A ratio that looks like a
    // three-column split must not turn a two-column row into three.
    expect(resolveColumnRatio([percent(33), percent(33)], "2").layout).toBe(
      "2",
    );
    expect(resolveColumnRatio([px(600), px(300), px(300)], "3").layout).toBe(
      "3",
    );
  });
});
