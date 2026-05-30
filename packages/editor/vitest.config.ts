import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
import { inlineStyleCssPlugin } from "./scripts/inline-style-css-plugin";

export default defineConfig({
  plugins: [
    vue(),
    // Resolves `virtual:editor-css` in tests using the source CSS as a
    // fallback (no build artifacts exist in test mode).
    inlineStyleCssPlugin({
      fallbackSourcePath: resolve(import.meta.dirname, "src/styles/index.css"),
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      // Include Vue SFCs so component logic (computeds, methods, branch
      // conditions) is covered. Many components are exercised by mount
      // tests; the include keeps the rest visible rather than unmeasured.
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text", "json"],
      reportsDirectory: "./coverage",
    },
  },
});
