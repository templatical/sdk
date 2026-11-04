import { expect } from "vitest";

export function expectLinear(
  build: (n: number) => () => unknown,
  initialN: number,
  repetitions = 1,
): { n: number; ratio: number } {
  function bestOfThree(run: () => unknown): number {
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      for (let j = 0; j < repetitions; j++) run();
      best = Math.min(best, performance.now() - start);
    }
    return best;
  }

  let n = initialN;
  let small = bestOfThree(build(n));
  for (let i = 0; i < 4 && small < 5; i++) {
    n *= 2;
    small = bestOfThree(build(n));
  }
  const large = bestOfThree(build(4 * n));
  const ratio = large / small;
  if (process.env.LINEAR_SCAN_REPORT) {
    console.info(
      `n=${n} repetitions=${repetitions} small=${small.toFixed(2)}ms large=${large.toFixed(2)}ms ratio=${ratio.toFixed(2)}`,
    );
  }
  // Linear growth measures about 4; the quadratic code this guards against measures 16 or more.
  expect(ratio).toBeLessThan(10);
  return { n, ratio };
}
