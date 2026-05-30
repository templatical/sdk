import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      // Include Vue SFCs so component logic (computeds, methods, branch
      // conditions) is covered, not just the standalone modules and
      // composables.
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text", "json"],
      reportsDirectory: "./coverage",
    },
  },
});
