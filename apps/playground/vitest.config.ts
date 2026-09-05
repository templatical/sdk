import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // SFCs are transformable so a module that names one — the drawer's tab
  // table maps each tab to its pane — can be imported and asserted on. It
  // does not make components mountable: there is no `@vue/test-utils` here,
  // and component-level guarantees stay e2e or source-text.
  plugins: [vue()],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "happy-dom",
  },
  resolve: {
    // Only `@`. `@templatical/*` deliberately resolves to each package's
    // built `dist` here, which is the repo-wide rule for tests — aliasing
    // those to source would pull a second copy of every package into the
    // graph and test something the playground does not consume.
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
