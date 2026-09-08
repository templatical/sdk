import { describe, expect, it } from "vitest";
import { getWidthPercentages } from "@templatical/renderer";
import type { ColumnLayout } from "@templatical/types";
import {
  LAYOUT_SHARES,
  readColumnWidth,
  resolveColumnRatio,
} from "../column-ratio";
import type { ColumnWidth } from "../column-ratio";

const ALL_LAYOUTS: ColumnLayout[] = ["1", "2", "3", "1-2", "2-1"];

function px(value: number): ColumnWidth {
  return { unit: "px", value };
}

function percent(value: number): ColumnWidth {
  return { unit: "%", value };
}

describe("column-ratio — the snap targets agree with the renderer", () => {
  /**
   * `@templatical/renderer` is a devDependency here and must stay one — the
   * importer has no runtime need of it — so `column-ratio.ts` carries its own
   * copy of the layout percentages. This is the only thing keeping the two
   * copies equal: without it the importer could choose `2-1` for a row the
   * renderer then renders at some other split, and no surface between the two
   * packages would notice.
   */
  it("carries the renderer's percentages for every layout, value for value", () => {
    // Compared directly, not through `resolveColumnRatio`: a drift smaller
    // than the snap tolerance still snaps to the same layout, so a target
    // moved from 50/50 to 55/45 satisfies every behavioural case in this file
    // while the importer and the renderer disagree.
    for (const layout of Object.keys(LAYOUT_SHARES) as ColumnLayout[]) {
      expect(LAYOUT_SHARES[layout]).toEqual(
        getWidthPercentages(layout).map((width) => parseFloat(width)),
      );
    }
  });

  it("keys the table by every ColumnLayout", () => {
    // `LAYOUT_SHARES` is annotated `Record<ColumnLayout, …>`, so a new layout
    // is a compile error until it is added. This is the runtime half: it fails
    // if that annotation is ever loosened to a plain object, which would let a
    // layout exist that nothing can snap to.
    expect((Object.keys(LAYOUT_SHARES) as ColumnLayout[]).sort()).toEqual([
      "1",
      "1-2",
      "2",
      "2-1",
      "3",
    ]);
    expect(ALL_LAYOUTS.length).toBe(Object.keys(LAYOUT_SHARES).length);
  });

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
    // it out from among the three, so the table cannot be off by a column
    // order (which would swap 1-2 and 2-1 while every symmetric case passed).
    const from = (layout: ColumnLayout) =>
      resolveColumnRatio(
        getWidthPercentages(layout).map((width) => percent(parseFloat(width))),
        "2",
      ).layout;
    expect(from("2")).toBe("2");
    expect(from("1-2")).toBe("1-2");
    expect(from("2-1")).toBe("2-1");
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

  it("names an 80/20 ratio it cannot express", () => {
    expect(resolveColumnRatio([percent(80), percent(20)], "2")).toEqual({
      layout: "2",
      note:
        "Column widths 80% / 20% have no Templatical equivalent. " +
        "The section was imported as 2 equal columns.",
    });
  });

  it("names a 130/280/130 ratio, which the model has no layout for", () => {
    expect(resolveColumnRatio([px(130), px(280), px(130)], "3")).toEqual({
      layout: "3",
      note:
        "Column widths 24.1% / 51.9% / 24.1% have no Templatical equivalent. " +
        "The section was imported as 3 equal columns.",
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
    // 64.8 / 35.2 is 1.9pp from 2-1 and matches; the 80/20 above is 13.3pp
    // and does not. These two pin the band: a 4pp-off ratio still snaps, and
    // a 10pp-off one does not.
    expect(
      resolveColumnRatio([percent(62.67), percent(37.33)], "2").layout,
    ).toBe("2-1");
    expect(
      resolveColumnRatio([percent(56.67), percent(43.33)], "2").layout,
    ).toBe("2");
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
