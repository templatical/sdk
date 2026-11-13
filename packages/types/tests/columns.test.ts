import { describe, expect, it } from "vitest";
import type { ColumnLayout, SectionBlock } from "../src/blocks";
import {
  COLUMN_LAYOUT_PERCENTS,
  columnWidthsIssue,
  sectionColumnPercents,
} from "../src/columns";

const PRESETS: Record<ColumnLayout, readonly number[]> = {
  "1": [100],
  "2": [50, 50],
  "3": [33.33, 33.33, 33.34],
  "4": [25, 25, 25, 25],
  "1-2": [33.33, 66.67],
  "2-1": [66.67, 33.33],
  "1-3": [25, 75],
  "3-1": [75, 25],
  "1-2-1": [25, 50, 25],
};

function section(
  columns: SectionBlock["columns"],
  columnWidths?: SectionBlock["columnWidths"],
): Pick<SectionBlock, "columns" | "columnWidths"> {
  return columnWidths === undefined ? { columns } : { columns, columnWidths };
}

describe("COLUMN_LAYOUT_PERCENTS", () => {
  it("matches the preset split the renderer emits", () => {
    expect(COLUMN_LAYOUT_PERCENTS).toEqual(PRESETS);
  });
});

describe("columnWidthsIssue", () => {
  it("is null when columnWidths is absent", () => {
    expect(columnWidthsIssue(section("3"))).toBeNull();
  });

  it("is null for a usable override", () => {
    expect(columnWidthsIssue(section("3", [25, 25, 50]))).toBeNull();
    expect(columnWidthsIssue(section("3", [1, 1, 2]))).toBeNull();
  });

  it("reports a length that differs from the layout's column count", () => {
    expect(columnWidthsIssue(section("3", [50, 50]))).toBe("count");
    expect(columnWidthsIssue(section("2", [25, 25, 50]))).toBe("count");
    expect(columnWidthsIssue(section("4", []))).toBe("count");
  });

  it("reports a value that is not a finite number above 0", () => {
    expect(columnWidthsIssue(section("2", [0, 100]))).toBe("value");
    expect(columnWidthsIssue(section("2", [-1, 2]))).toBe("value");
    expect(columnWidthsIssue(section("2", [Number.NaN, 1]))).toBe("value");
    expect(columnWidthsIssue(section("2", [Number.POSITIVE_INFINITY, 1]))).toBe(
      "value",
    );
    expect(
      columnWidthsIssue(section("2", ["50", 50] as unknown as number[])),
    ).toBe("value");
  });

  it("reports count before value when both are wrong", () => {
    expect(columnWidthsIssue(section("3", [0, -1]))).toBe("count");
  });

  it("reports a hole in a sparse array as a value", () => {
    const sparse: number[] = [1, 1, 1];
    delete sparse[1];
    expect(1 in sparse).toBe(false);
    expect(columnWidthsIssue(section("3", sparse))).toBe("value");
  });

  it("reports a runtime non-array as a value", () => {
    expect(
      columnWidthsIssue(section("2", "25,75" as unknown as number[])),
    ).toBe("value");
    expect(columnWidthsIssue(section("2", {} as unknown as number[]))).toBe(
      "value",
    );
  });
});

describe("inherited layout names", () => {
  it.each(["constructor", "toString", "__proto__"] as const)(
    "uses the unknown-layout fallback for %s",
    (layout) => {
      expect(
        sectionColumnPercents({ columns: layout as ColumnLayout }),
      ).toEqual([100]);
      expect(columnWidthsIssue({ columns: layout as ColumnLayout })).toBeNull();
    },
  );
});

describe("sectionColumnPercents", () => {
  it.each(Object.entries(PRESETS) as Array<[ColumnLayout, readonly number[]]>)(
    "returns the %s preset when columnWidths is absent",
    (columns, percents) => {
      expect(sectionColumnPercents(section(columns))).toEqual(percents);
    },
  );

  it("scales [25, 25, 50] to itself", () => {
    expect(sectionColumnPercents(section("3", [25, 25, 50]))).toEqual([
      25, 25, 50,
    ]);
  });

  it("scales [1, 1, 2] to 25 / 25 / 50", () => {
    expect(sectionColumnPercents(section("3", [1, 1, 2]))).toEqual([
      25, 25, 50,
    ]);
  });

  it("keeps [50, 33.33, 16.67]", () => {
    expect(sectionColumnPercents(section("3", [50, 33.33, 16.67]))).toEqual([
      50, 33.33, 16.67,
    ]);
  });

  it("scales [6, 2, 2, 2] to 50 / 16.67 / 16.67 / 16.66", () => {
    expect(sectionColumnPercents(section("4", [6, 2, 2, 2]))).toEqual([
      50, 16.67, 16.67, 16.66,
    ]);
  });

  it("returns the preset for a sparse array", () => {
    const sparse: number[] = [1, 1, 1];
    delete sparse[1];
    expect(sectionColumnPercents(section("3", sparse))).toEqual(PRESETS["3"]);
  });

  it("returns the preset for a runtime non-array", () => {
    expect(
      sectionColumnPercents(section("2", "25,75" as unknown as number[])),
    ).toEqual(PRESETS["2"]);
    expect(
      sectionColumnPercents(section("2", {} as unknown as number[])),
    ).toEqual(PRESETS["2"]);
  });

  it("scales two huge equal shares to 50 / 50", () => {
    expect(sectionColumnPercents(section("2", [1e308, 1e308]))).toEqual([
      50, 50,
    ]);
    expect(
      sectionColumnPercents(section("2", [Number.MAX_VALUE, 1])),
    ).toEqual([99.99, 0.01]);
  });

  it("takes a tied debt from the later column, and leaves a column with nothing to spare", () => {
    // Both large shares have remainder 0, so the later one gives the
    // hundredth back. The tiny share was lifted to 0.01 and cannot pay.
    expect(sectionColumnPercents(section("3", [1, 1, 1e-15]))).toEqual([
      50, 49.99, 0.01,
    ]);
  });

  it("stops once the debt is paid when remainders differ", () => {
    // The two tiny shares tie and have nothing to spare. `1` has a smaller
    // remainder than `100`, so it pays the hundredth and `100` is not touched.
    expect(sectionColumnPercents(section("4", [100, 1e-8, 1e-8, 1]))).toEqual([
      99, 0.01, 0.01, 0.98,
    ]);
  });

  it("keeps every share at least 0.01 and totals 100", () => {
    const row = sectionColumnPercents(
      section("4", [33.335, 33.335, 33.329, 0.001]),
    );
    expect(row).toEqual([33.33, 33.33, 33.33, 0.01]);
    expect(row.reduce((sum, value) => sum + value, 0)).toBe(100);
    for (const value of row) expect(value).toBeGreaterThanOrEqual(0.01);
  });

  it("gives the first of three equal shares the extra hundredth", () => {
    const row = sectionColumnPercents(section("3", [1, 1, 1]));
    expect(row).toEqual([33.34, 33.33, 33.33]);
    expect(row.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("returns the preset when the override is unusable", () => {
    expect(sectionColumnPercents(section("3", [50, 50]))).toEqual(
      PRESETS["3"],
    );
    expect(sectionColumnPercents(section("2", [0, 1]))).toEqual(PRESETS["2"]);
    expect(sectionColumnPercents(section("2", [-4, 8]))).toEqual(PRESETS["2"]);
    expect(sectionColumnPercents(section("2", [Number.NaN, 1]))).toEqual(
      PRESETS["2"],
    );
    expect(
      sectionColumnPercents(section("2", [Number.POSITIVE_INFINITY, 1])),
    ).toEqual(PRESETS["2"]);
    expect(
      sectionColumnPercents(section("2", ["50", 50] as unknown as number[])),
    ).toEqual(PRESETS["2"]);
  });

  it("returns [100] for an unknown layout", () => {
    expect(
      sectionColumnPercents({ columns: "nope" as ColumnLayout }),
    ).toEqual([100]);
  });

  it("totals 100 to two decimals", () => {
    const rows = [
      sectionColumnPercents(section("3", [1, 1, 2])),
      sectionColumnPercents(section("4", [6, 2, 2, 2])),
      sectionColumnPercents(section("3", [50, 33.33, 16.67])),
      sectionColumnPercents(section("2", [5, 7])),
    ];
    for (const row of rows) {
      const hundredths = row.reduce(
        (sum, value) => sum + Math.round(Number(`${value}e2`)),
        0,
      );
      expect(hundredths).toBe(10000);
    }
  });
});
