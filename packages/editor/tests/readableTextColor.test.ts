import { describe, expect, it } from "vitest";
import { readableTextColor } from "../src/utils/readableTextColor";

describe("readableTextColor", () => {
  it("returns dark text on bright yellow background", () => {
    expect(readableTextColor("#f59e0b")).toBe("#1f1f1f");
  });

  it("returns light text on deep navy background", () => {
    expect(readableTextColor("#000080")).toBe("#ffffff");
  });

  it("returns light text on pure black", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff");
  });

  it("returns dark text on pure white", () => {
    expect(readableTextColor("#ffffff")).toBe("#1f1f1f");
  });

  it("expands 3-digit hex", () => {
    // #fff == white → dark text
    expect(readableTextColor("#fff")).toBe("#1f1f1f");
    // #000 == black → light text
    expect(readableTextColor("#000")).toBe("#ffffff");
  });

  it("accepts hex without leading hash", () => {
    expect(readableTextColor("ffffff")).toBe("#1f1f1f");
    expect(readableTextColor("000000")).toBe("#ffffff");
  });

  it("falls back to light on unparseable input", () => {
    expect(readableTextColor("not-a-color")).toBe("#ffffff");
    expect(readableTextColor("")).toBe("#ffffff");
    expect(readableTextColor("#xyz")).toBe("#ffffff");
  });

  it("honors custom light and dark overrides", () => {
    expect(
      readableTextColor("#ffffff", { dark: "#101820", light: "#fefefe" }),
    ).toBe("#101820");
    expect(
      readableTextColor("#000000", { dark: "#101820", light: "#fefefe" }),
    ).toBe("#fefefe");
  });

  it("picks readable text across the collaborator palette", () => {
    const palette = [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#f97316",
      "#6366f1",
      "#14b8a6",
    ];
    // Every result must be one of the two valid options — no undefineds
    for (const color of palette) {
      const result = readableTextColor(color);
      expect(["#ffffff", "#1f1f1f"]).toContain(result);
    }
  });
});
