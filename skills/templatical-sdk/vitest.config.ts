import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // No suites exist yet — a later task adds the freshness/router/version/
    // safety tests this config is scoped for. Without this flag, an empty
    // tests/ directory makes Vitest exit non-zero and fails the
    // workspace-wide `pnpm run test`. Drop it once real tests land; a
    // package that goes back to zero test files afterward should fail loud.
    passWithNoTests: true,
  },
});
