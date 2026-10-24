import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // The reference-server and conformance suites bind a local HTTP port and
    // stream; the same 20s budget template-tools uses for its I/O suites.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text", "json"],
      reportsDirectory: "./coverage",
    },
  },
});
