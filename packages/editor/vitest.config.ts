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
    // are not that: they regex the whole source tree once per test. What makes
    // the remaining margin impossible to judge locally is CI variance, not the
    // work itself — `schema-freshness` ran 1091ms on one CI run and 4902ms on
    // the next, passing by 98ms before it tipped over and turned a PR red.
    //
    // The structural scans here are the exposed ones — they regex the whole
    // source tree (233 files, 1.3MB) once per test. Slowest is currently 413ms
    // in a full parallel run (`richTextSpacingParity`), 56ms when its file runs
    // alone; the gap is worker contention, not I/O. Re-reading the tree is
    // nearly free after the first pass because the page cache serves it —
    // measured 80ms for 11 full reads — so there is no memoisation win here.
    //
    // 20s is deliberate headroom rather than a fitted value: the failure this
    // guards against is CI variance, which swung one test 1091ms -> 4902ms on
    // consecutive runs. A hung test still fails in bounded time.
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
