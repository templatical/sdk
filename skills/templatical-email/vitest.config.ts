import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Vitest's 5s default is a budget for a unit test, and several suites here
    // are not that: they scan the whole source tree, spawn processes, or build a
    // TypeScript program. That work is I/O-bound, so it is cheap on a warm dev
    // machine and several times dearer on a cold CI runner — the gap is not a
    // safety margin you can eyeball locally. Measured: `schema-freshness` ran
    // 1091ms in CI and 4902ms on the very next run, passing by 98ms before it
    // finally tipped over and turned a PR red.
    // This suite does the heaviest non-unit work in the repo: live-server spawns
    // real processes and binds sockets, import.mjs loads the converter packages
    // and runs real fixtures, and schema-freshness builds a TypeScript program.
    testTimeout: 20_000,
  },
});
