// Golden operations from origin/main 200ab00 for seeds 1–200 and two review cases.
// Regenerate: `git show 200ab00:packages/core/src/diff-content.ts > packages/core/tests/helpers/diff-content-main.ts`.
// In a temporary Vitest test, replace each case's operations with that helper's
// diffContent(before, after), then write JSON.stringify(cases) plus a newline.
// Remove the temporary test and helper after generating.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { Operation, TemplateContent } from "@templatical/types";
import { applyOperations } from "@templatical/types";
import { diffContent } from "../src/diff-content";

interface Case {
  seed?: number;
  name?: string;
  before: TemplateContent;
  after: TemplateContent;
  operations: Operation[];
}

const cases = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "fixtures/diff-content-legacy.json"),
    "utf8",
  ),
) as Case[];

it("contains 200 seeded edits and the two review cases", () => {
  expect(cases.length).toBe(202);
  expect(cases.filter((entry) => entry.seed !== undefined).length).toBe(200);
  expect(
    cases.filter((entry) => entry.name).map((entry) => entry.name),
  ).toEqual([
    "hidden:false combined with text after a base edit",
    "adds a locale before clearing a removed hidden layer",
  ]);
});

for (const entry of cases) {
  it(`matches origin/main operations for ${entry.name ?? `seed ${entry.seed}`}`, () => {
    expect(JSON.stringify(diffContent(entry.before, entry.after))).toBe(
      JSON.stringify(entry.operations),
    );
    expect(applyOperations(entry.before, entry.operations)).toEqual(
      entry.after,
    );
  });
}
