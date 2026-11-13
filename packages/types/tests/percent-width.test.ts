import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PERCENT_WIDTH_PATTERN,
  parsePercentWidth,
  roundHundredths,
} from "../src/percent-width";

describe("PERCENT_WIDTH_PATTERN", () => {
  it("matches the @pattern on PercentWidth", () => {
    const blocks = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/blocks.ts"),
      "utf8",
    );
    const published = blocks.match(/@pattern\s+(\S+)/);
    expect(published?.[1]).toBe(PERCENT_WIDTH_PATTERN.source);
  });
});

describe("parsePercentWidth", () => {
  it("returns the number for a share above 0 and at most 100", () => {
    expect(parsePercentWidth("40%")).toBe(40);
    expect(parsePercentWidth("33.33%")).toBe(33.33);
    expect(parsePercentWidth("100%")).toBe(100);
    expect(parsePercentWidth("100.0%")).toBe(100);
    expect(parsePercentWidth("0.05%")).toBe(0.05);
  });

  it("returns null for anything that is not that share", () => {
    expect(parsePercentWidth("0%")).toBeNull();
    expect(parsePercentWidth("150%")).toBeNull();
    expect(parsePercentWidth("abc%")).toBeNull();
    expect(parsePercentWidth("abc")).toBeNull();
    expect(parsePercentWidth("40")).toBeNull();
    expect(parsePercentWidth(40)).toBeNull();
    expect(parsePercentWidth("")).toBeNull();
    expect(parsePercentWidth(undefined)).toBeNull();
  });
});

describe("roundHundredths", () => {
  it("rounds a midpoint away from the binary low side", () => {
    expect(roundHundredths(0.145)).toBe(0.15);
    expect(roundHundredths(1.005)).toBe(1.01);
    expect(roundHundredths(99.995)).toBe(100);
    expect(roundHundredths(33.333)).toBe(33.33);
  });

  it("rounds a value whose string is already an exponent", () => {
    expect(roundHundredths(1e-7)).toBe(0);
  });

  it("returns a huge finite value unchanged when the shifted exponent cannot be formed", () => {
    expect(roundHundredths(1e19)).toBe(1e19);
    expect(roundHundredths(1e300)).toBe(1e300);
    expect(roundHundredths(Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
    expect(roundHundredths(-1e19)).toBe(-1e19);
  });

  it("returns a non-finite value unchanged", () => {
    expect(roundHundredths(Number.NaN)).toBeNaN();
    expect(roundHundredths(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(roundHundredths(Number.NEGATIVE_INFINITY)).toBe(
      Number.NEGATIVE_INFINITY,
    );
  });
});
