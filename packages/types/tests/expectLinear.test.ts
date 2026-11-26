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
  it("measures a round again when the thread CPU time reads 0 ms", () => {
    // Warm-up small (6 ms, no doubling), then large, then four rounds of
    // small + large. The third small reading is 0 and must be measured again.
    stubCpuDeltas([
      6000, 24000, 6000, 24000, 0, 6000, 24000, 6000, 24000, 6000, 24000,
    ]);
    const result = expectLinear(() => () => undefined, 10);
    expect(result).toEqual({ repetitions: 1, ratio: 4 });
  });

  it("throws a clear error when a run keeps reading 0 ms", () => {
    stubCpuDeltas(Array.from({ length: 64 }, () => 0));
    expect(() => expectLinear(() => () => undefined, 10)).toThrow(
      "expectLinear: thread CPU time read 0 ms 5 times in a row",
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
