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
 *
 * A round that reads 0 ms means the run is shorter than the thread clock's
 * resolution: some runners count CPU time in scheduler ticks, so a short run
 * usually reads 0 and the warm-up can pass the floor on a lucky tick. Repetitions
 * then double and all five rounds are measured again, until a full set reads
 * above zero. Keeping a 0 would make the ratio Infinity.
 *
 * Repetitions always start at one and only double, so each round costs just
 * over the 5 ms floor. A caller-chosen starting count above the floor would make
 * all ten rounds that expensive and push the test past vitest's timeout under CI
 * coverage.
 */
const MAX_REPETITIONS = 1_000_000;

export function expectLinear(
  build: (n: number) => () => unknown,
  n: number,
): { repetitions: number; ratio: number } {
  let repetitions = 1;
  const runSmall = build(n);
  const runLarge = build(4 * n);
  function cost(run: () => unknown): number {
    const started = process.threadCpuUsage();
    for (let j = 0; j < repetitions; j++) run();
    const { user, system } = process.threadCpuUsage(started);
    return (user + system) / 1000;
  }
  /** The cheapest of five interleaved rounds per size, or null if any read 0 ms. */
  function rounds(): { small: number; large: number } | null {
    let small = Infinity;
    let large = Infinity;
    for (let round = 0; round < 5; round++) {
      const smallMs = cost(runSmall);
      const largeMs = cost(runLarge);
      if (smallMs <= 0 || largeMs <= 0) return null;
      small = Math.min(small, smallMs);
      large = Math.min(large, largeMs);
    }
    return { small, large };
  }

  let warmUp = cost(runSmall);
  while (warmUp < 5 && repetitions < MAX_REPETITIONS) {
    repetitions *= 2;
    warmUp = cost(runSmall);
  }
  let measured = rounds();
  while (!measured && repetitions < MAX_REPETITIONS) {
    repetitions *= 2;
    measured = rounds();
  }
  if (!measured) {
    throw new Error(
      `expectLinear: thread CPU time still read 0 ms at ${repetitions} repetitions; the run can't be measured`,
    );
  }
  const { small, large } = measured;
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
