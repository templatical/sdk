import { describe, expect, it } from "vitest";
import { unwrapValue } from "../normalize";
import type { ChamaileonVariable } from "../types";

describe("variable references", () => {
  it("resolves to the first variable with the name", () => {
    const variables: ChamaileonVariable[] = [
      { name: "brand", value: "#111111" },
      { name: "brand", value: "#222222" },
      { value: "#333333" },
    ];
    expect(unwrapValue({ reference: "brand" }, variables)).toBe("#111111");
    expect(unwrapValue({ reference: "missing" }, variables)).toBeUndefined();
  });

  it("skips a variable whose name is not a string", () => {
    const variables = [
      { name: 1, value: "#111111" },
    ] as unknown as ChamaileonVariable[];
    expect(unwrapValue({ reference: "1" }, variables)).toBeUndefined();
  });

  it("keeps an unset first match unresolved, as before", () => {
    const variables: ChamaileonVariable[] = [
      { name: "brand", value: "" },
      { name: "brand", value: "#222222" },
    ];
    expect(unwrapValue({ reference: "brand" }, variables)).toBeUndefined();
  });

  it("scales references times variables linearly", () => {
    const run = (n: number) => {
      const variables: ChamaileonVariable[] = Array.from(
        { length: n },
        (_, i) => ({ name: `v${i}`, value: `#${i}` }),
      );
      const start = performance.now();
      let resolved = 0;
      for (let i = 0; i < n; i++) {
        if (unwrapValue({ reference: `missing${i}` }, variables) === undefined)
          resolved++;
      }
      expect(resolved).toBe(n);
      return performance.now() - start;
    };
    const best = (n: number) => Math.min(run(n), run(n), run(n));
    // An 8x step: per-call overhead hides a quadratic over a 4x step at sizes
    // small enough for CI. Measured: about 5 for a lookup table, about 18 for a
    // linear search per reference.
    const n = 1_000;
    const small = best(n);
    const large = best(8 * n);
    const ratio = large / small;
    if (process.env.LINEAR_SCAN_REPORT)
      console.info(
        `variables n=${n} small=${small.toFixed(2)}ms large=${large.toFixed(2)}ms ratio=${ratio.toFixed(2)}`,
      );
    expect(ratio).toBeLessThan(12);
  }, 30_000);
});
