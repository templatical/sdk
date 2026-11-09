/// <reference types="node" />
import { expect } from "vitest";

/**
 * Asserts that a run's cost grows linearly with its input instead of checking a
 * time budget, which fails on a slow or busy runner: CI under coverage runs these
 * scans tens of times slower than a laptop. Four times the input costs about four
 * times as much when the scan is linear, and about sixteen when it is quadratic.
 *
 * The cost is this thread's CPU time, not wall time: on a busy machine the longer
 * run is preempted more often, which pushes a wall-clock ratio of linear code past
 * the limit. The input stays at `n` and `4n` while the run repeats until it costs
 * enough to measure, because inputs that outgrow the CPU cache cost more per
 * character and skew the ratio. Each size keeps its cheapest of five interleaved
 * rounds, so a garbage-collection pause or a JIT tier-up in one round does not
 * count.
 */
export function expectLinear(
  build: (n: number) => () => unknown,
  n: number,
  repetitions = 1,
): { repetitions: number; ratio: number } {
  const runSmall = build(n);
  const runLarge = build(4 * n);
  function cost(run: () => unknown): number {
    const started = process.threadCpuUsage();
    for (let j = 0; j < repetitions; j++) run();
    const { user, system } = process.threadCpuUsage(started);
    return (user + system) / 1000;
  }

  let small = cost(runSmall);
  while (small < 5 && repetitions < 1_000_000) {
    repetitions *= 2;
    small = cost(runSmall);
  }
  let large = cost(runLarge);
  for (let round = 1; round < 5; round++) {
    small = Math.min(small, cost(runSmall));
    large = Math.min(large, cost(runLarge));
  }
  const ratio = large / small;
  if (process.env.LINEAR_SCAN_REPORT) {
    console.info(
      `n=${n} repetitions=${repetitions} small=${small.toFixed(2)}ms large=${large.toFixed(2)}ms ratio=${ratio.toFixed(2)}`,
    );
  }
  // Linear growth measures about 4; the quadratic code this guards against measures 16 or more.
  expect(ratio).toBeLessThan(10);
  return { repetitions, ratio };
}
