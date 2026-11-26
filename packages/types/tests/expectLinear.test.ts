/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectLinear } from "./helpers/expectLinear";

/** Feed `process.threadCpuUsage` deltas, in microseconds, one per measured run. */
function stubCpuDeltas(deltasMicros: number[]): void {
  const queue = [...deltasMicros];
  vi.spyOn(process, "threadCpuUsage").mockImplementation(((
    previous?: NodeJS.CpuUsage,
  ) => {
    if (!previous) return { user: 0, system: 0 };
    const next = queue.shift();
    if (next === undefined) throw new Error("ran out of stubbed CPU readings");
    return { user: next, system: 0 };
  }) as typeof process.threadCpuUsage);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("expectLinear", () => {
  it("doubles repetitions and measures every round again when a round reads 0 ms", () => {
    // Warm-up small (6 ms, no doubling). The first set of rounds hits a 0 ms
    // reading, so repetitions double and five clean rounds follow.
    stubCpuDeltas([
      6000, 6000, 24000, 0, 24000, 12000, 48000, 12000, 48000, 12000, 48000,
      12000, 48000, 12000, 48000,
    ]);
    const result = expectLinear(() => () => undefined, 10);
    expect(result).toEqual({ repetitions: 2, ratio: 4 });
  });

  it("keeps the cheapest round of each size", () => {
    stubCpuDeltas([
      6000, 7000, 30000, 6000, 24000, 9000, 26000, 6500, 25000, 8000, 27000,
    ]);
    const result = expectLinear(() => () => undefined, 10);
    expect(result).toEqual({ repetitions: 1, ratio: 4 });
  });

  it("throws a clear error when the clock keeps reading 0 ms", () => {
    stubCpuDeltas(Array.from({ length: 64 }, () => 0));
    expect(() => expectLinear(() => () => undefined, 10)).toThrow(
      "expectLinear: thread CPU time still read 0 ms at 1048576 repetitions",
    );
  });
});

describe("expectLinear copies", () => {
  it("keeps every package's copy byte-identical", () => {
    const repoRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../..",
    );
    const files = execFileSync("git", ["ls-files", "*expectLinear.ts"], {
      cwd: repoRoot,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    expect(files).toContain("packages/types/tests/helpers/expectLinear.ts");
    expect(files.length).toBeGreaterThan(1);
    const source = readFileSync(
      join(repoRoot, "packages/types/tests/helpers/expectLinear.ts"),
      "utf8",
    );
    const different = files.filter(
      (file) => readFileSync(join(repoRoot, file), "utf8") !== source,
    );
    expect(different).toEqual([]);
  });
});
