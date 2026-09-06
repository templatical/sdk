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
    // Vitest's 5s default is a budget for a unit test, and several suites here
    // are not that: they scan the whole source tree, spawn processes, or build a
    // TypeScript program. That work is I/O-bound, so it is cheap on a warm dev
    // machine and several times dearer on a cold CI runner — the gap is not a
    // safety margin you can eyeball locally. Measured: `schema-freshness` ran
    // 1091ms in CI and 4902ms on the very next run, passing by 98ms before it
    // finally tipped over and turned a PR red.
    //
    // The structural scans here are the exposed ones: the slowest is 2402ms
    // warm ("no <variant>:tpl: utilities anywhere in source"), already half the
    // default, with richTextSpacingParity at 1609ms behind it. 20s keeps roughly
    // 2x headroom over the worst CI factor observed, while still failing a
    // genuinely hung test in bounded time.
    testTimeout: 20_000,
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
