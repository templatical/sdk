import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // The reference-server and conformance suites bind a local HTTP port and
    // stream; the same 20s budget template-tools uses for its I/O suites.
    testTimeout: 20_000,
  },
});
