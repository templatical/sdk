import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "happy-dom",
  },
  resolve: {
    // Only `@`. `@templatical/*` deliberately resolves to each package's
    // built `dist` here, which is the repo-wide rule for tests — aliasing
    // those to source would also pull `.vue` files into a config with no
    // Vue plugin.
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
