import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Vitest's 5s default is a budget for a unit test, and several suites here
    // are not that: the CLI suites spawn the built binary and bind sockets, the
    // import suites load real converter packages and run real fixtures, and
    // schema-freshness builds a TypeScript program. That work is I/O-bound, so
    // it is cheap on a warm dev machine and several times dearer on a cold CI
    // runner — and `pnpm run test` runs every package concurrently, which is
    // exactly what CI does. The same 20s the editor and skill suites use,
    // for the same reason.
    testTimeout: 20_000,
  },
});
