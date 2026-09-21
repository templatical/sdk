import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const packagesDir = resolve(import.meta.dirname, "../../packages");

export default defineConfig({
  resolve: {
    alias: {
      // Workspace packages export dist/; tests run without a prior build.
      "@templatical/types": resolve(packagesDir, "types/src/index.ts"),
      "@templatical/core": resolve(packagesDir, "core/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
