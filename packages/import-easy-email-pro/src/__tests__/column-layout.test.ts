import { describe, expect, it } from "vitest";
import { matchColumnLayout } from "../column-layout";

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

  it("folds 4 columns to 3, inexact", () => {
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "3",
      exact: false,
    });
  });
});
