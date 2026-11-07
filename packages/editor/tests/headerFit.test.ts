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
      statusLabel: true,
    });
  });

  it("compacts an overflowing full layout above the former fixed breakpoint", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1100,
        rightWidth: 400,
      }),
    ).toEqual({ compact: true, fullWidth: 1132, statusLabel: false });
  });

  it("reserves equal side tracks so the larger left group cannot cover the centre", () => {
    expect(
      decideHeaderFit({ ...measurement, availableWidth: 1000, leftWidth: 400 }),
    ).toEqual({ compact: true, fullWidth: 1132, statusLabel: false });
  });

  it("includes both column gaps, padding and borders at the exact fit boundary", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 750,
        columnGap: 8,
        borderWidth: 2,
      }),
    ).toEqual({ compact: false, fullWidth: 750, statusLabel: true });
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 749,
        columnGap: 8,
        borderWidth: 2,
      }),
    ).toEqual({ compact: true, fullWidth: 750, statusLabel: false });
  });

  it("stays compact throughout the band that fits only compact controls", () => {
    const full = { ...measurement, rightWidth: 400 };
    expect(
      [900, 1050, 1131, 1132].map((availableWidth) =>
        decideHeaderFit({ ...full, availableWidth }),
      ),
    ).toEqual([
      { compact: true, fullWidth: 1132, statusLabel: false },
      { compact: true, fullWidth: 1132, statusLabel: false },
      { compact: true, fullWidth: 1132, statusLabel: false },
      { compact: false, fullWidth: 1132, statusLabel: true },
    ]);
  });

  it("replaces the full-width requirement when hidden full-label content changes", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1200,
        rightWidth: 500,
      }),
    ).toEqual({ compact: true, fullWidth: 1332, statusLabel: false });
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1200,
        rightWidth: 200,
      }),
    ).toEqual({ compact: false, fullWidth: 732, statusLabel: true });
  });

  describe("save-status label", () => {
    // The status badge's words come and go with every edit and save. They
    // never decide the layout: the full width is measured without them, and
    // they show only where the full header has room for them too.
    const withStatus = { ...measurement, rightWidth: 300, statusLabelWidth: 60 };

    it("leaves the label out of the full-width requirement", () => {
      expect(decideHeaderFit({ ...withStatus, availableWidth: 900 })).toEqual({
        compact: false,
        fullWidth: 812,
        statusLabel: false,
      });
    });

    it("keeps the full header and hides only the label when the label alone does not fit", () => {
      expect(
        [811, 812, 931, 932].map((availableWidth) =>
          decideHeaderFit({ ...withStatus, availableWidth }),
        ),
      ).toEqual([
        { compact: true, fullWidth: 812, statusLabel: false },
        { compact: false, fullWidth: 812, statusLabel: false },
        { compact: false, fullWidth: 812, statusLabel: false },
        { compact: false, fullWidth: 812, statusLabel: true },
      ]);
    });

    it("counts the label only when it makes the right side the wider one", () => {
      const left = { ...measurement, availableWidth: 800, leftWidth: 230 };
      expect(
        decideHeaderFit({ ...left, rightWidth: 220, statusLabelWidth: 60 }),
      ).toEqual({ compact: false, fullWidth: 792, statusLabel: true });
      expect(
        decideHeaderFit({ ...left, rightWidth: 290, statusLabelWidth: 60 }),
      ).toEqual({ compact: false, fullWidth: 792, statusLabel: false });
    });
  });
});
