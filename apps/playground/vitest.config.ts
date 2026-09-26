import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const packagesDir = resolve(import.meta.dirname, "../../packages");

export default defineConfig({
  resolve: {
    alias: {
      // Workspace packages export dist/; tests run without a prior build.
      "@templatical/types": resolve(packagesDir, "types/src/index.ts"),
      "@templatical/core": resolve(packagesDir, "core/src/index.ts"),
      "@templatical/quality": resolve(packagesDir, "quality/src/index.ts"),
      "@templatical/import-unlayer": resolve(
        packagesDir,
        "import-unlayer/src/index.ts",
      ),
      "@templatical/import-beefree": resolve(
        packagesDir,
        "import-beefree/src/index.ts",
      ),
      "@templatical/import-html": resolve(
        packagesDir,
        "import-html/src/index.ts",
      ),
      "@templatical/import-mjml": resolve(
        packagesDir,
        "import-mjml/src/index.ts",
      ),
      "@templatical/import-topol": resolve(
        packagesDir,
        "import-topol/src/index.ts",
      ),
      "@templatical/import-stripo": resolve(
        packagesDir,
        "import-stripo/src/index.ts",
      ),
      "@templatical/import-chamaileon": resolve(
        packagesDir,
        "import-chamaileon/src/index.ts",
      ),
      "@templatical/import-easy-email-pro": resolve(
        packagesDir,
        "import-easy-email-pro/src/index.ts",
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
