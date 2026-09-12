import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // No `passWithNoTests`, deliberately. These suites are what stop a
    // dangling router entry, an orphaned island or a skewed schema from
    // shipping, and a rename that made this glob match nothing would
    // otherwise exit 0 — reporting the skill as passing while testing none
    // of it.
  },
});
