import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // No `passWithNoTests`, deliberately. This skill's four suites are what
    // stop a hand-edited reference tree, a dangling router entry or a skewed
    // version from shipping, and a rename that made this glob match nothing
    // would otherwise exit 0 — reporting the skill as passing while testing
    // none of it.
  },
});
