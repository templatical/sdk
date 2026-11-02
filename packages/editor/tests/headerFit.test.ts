import { describe, expect, it } from "vitest";
import { decideHeaderFit } from "../src/composables/useHeaderFit";

const measurement = {
  availableWidth: 800,
  leftWidth: 170,
  centerWidth: 300,
  rightWidth: 200,
  paddingWidth: 32,
  columnGap: 0,
  borderWidth: 0,
};

describe("header fit decision", () => {
  it("keeps full labels when they fit below the former fixed breakpoint", () => {
    expect(decideHeaderFit(measurement)).toEqual({
      compact: false,
      fullWidth: 732,
    });
  });

  it("compacts an overflowing full layout above the former fixed breakpoint", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1100,
        rightWidth: 400,
      }),
    ).toEqual({ compact: true, fullWidth: 1132 });
  });

  it("reserves equal side tracks so the larger left group cannot cover the centre", () => {
    expect(
      decideHeaderFit({ ...measurement, availableWidth: 1000, leftWidth: 400 }),
    ).toEqual({ compact: true, fullWidth: 1132 });
  });

  it("includes both column gaps, padding and borders at the exact fit boundary", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 750,
        columnGap: 8,
        borderWidth: 2,
      }),
    ).toEqual({ compact: false, fullWidth: 750 });
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 749,
        columnGap: 8,
        borderWidth: 2,
      }),
    ).toEqual({ compact: true, fullWidth: 750 });
  });

  it("stays compact throughout the band that fits only compact controls", () => {
    const full = { ...measurement, rightWidth: 400 };
    expect(
      [900, 1050, 1131, 1132].map((availableWidth) =>
        decideHeaderFit({ ...full, availableWidth }),
      ),
    ).toEqual([
      { compact: true, fullWidth: 1132 },
      { compact: true, fullWidth: 1132 },
      { compact: true, fullWidth: 1132 },
      { compact: false, fullWidth: 1132 },
    ]);
  });

  it("replaces the full-width requirement when hidden full-label content changes", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1200,
        rightWidth: 500,
      }),
    ).toEqual({ compact: true, fullWidth: 1332 });
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1200,
        rightWidth: 200,
      }),
    ).toEqual({ compact: false, fullWidth: 732 });
  });
});
