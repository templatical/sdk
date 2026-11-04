import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("runs validation on every CI pull request regardless of its branch name", () => {
  const ci = readFileSync(
    join(import.meta.dirname, "../../../.github/workflows/ci.yml"),
    "utf8",
  );

  // Only report handling may depend on status; validation must not depend on
  // a contributor-controlled branch name or any other PR property.
  const conditions = [...ci.matchAll(/^\s*(?:-\s*)?if:\s*(.+)$/gm)].map(
    (match) => match[1],
  );
  expect(conditions).toEqual([
    "${{ !cancelled() }}",
    "failure()",
    "failure()",
    "${{ !cancelled() && needs.e2e.result != 'skipped' }}",
  ]);
  expect(ci).not.toMatch(/github\.(?:head_ref|ref_name)/);
  for (const command of [
    "pnpm run format:check",
    "pnpm run lint",
    "pnpm run deps:check",
    "pnpm run typecheck",
    "pnpm run build",
    "pnpm run test:coverage",
    "pnpm exec playwright test --shard=",
    "pnpm run test:e2e:consumer",
    "pnpm run test:webpack-consumer",
    "pnpm run test:examples ",
  ]) {
    expect(ci).toContain(command);
  }
});
