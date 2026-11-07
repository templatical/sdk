import { describe, expect, it } from "vitest";
import { warn } from "../localization";

describe("import warnings", () => {
  it("adds a message once, counting messages pushed directly", () => {
    const warnings = ["first"];
    warn(warnings, "second");
    warnings.push("pushed");
    warn(warnings, "pushed");
    warn(warnings, "first");
    warn(warnings, "third");
    warn(warnings, "second");
    expect(warnings).toEqual(["first", "second", "pushed", "third"]);
  });

  it("starts over when the list is shortened", () => {
    const warnings: string[] = [];
    warn(warnings, "a");
    warnings.length = 0;
    warn(warnings, "a");
    expect(warnings).toEqual(["a"]);
  });

  it("scales with the number of distinct messages linearly", () => {
    const run = (n: number) => {
      let best = Infinity;
      for (let i = 0; i < 3; i++) {
        const warnings: string[] = [];
        const start = performance.now();
        for (let j = 0; j < n; j++) warn(warnings, `Dropped language "x${j}".`);
        best = Math.min(best, performance.now() - start);
        expect(warnings).toHaveLength(n);
      }
      return best;
    };
    const n = 2_000;
    const small = run(n);
    const large = run(4 * n);
    expect(large / small).toBeLessThan(10);
  }, 30_000);
});
