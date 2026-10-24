import { describe, expect, it } from "vitest";
import { applyOperations, invertOperations } from "@templatical/types";
import * as core from "../src";
import { diffContent } from "../src/diff-content";
import {
  createGenerator,
  randomContent,
  randomEdit,
} from "./helpers/random-content";

// invertOperations lives in @templatical/types, which tests its cases. This
// file keeps the re-export guard and the round trip through core's diff.
describe("invertOperations re-export", () => {
  it("is the same function core re-exports (guard: D1)", () => {
    expect(core.invertOperations).toBe(invertOperations);
  });
});

describe("invertOperations over core's diffs", () => {
  it("undoes 500 seeded random diffs exactly", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const gen = createGenerator(seed);
      const before = randomContent(gen);
      const ops = diffContent(before, randomEdit(gen, before));
      const after = applyOperations(before, ops);

      expect(
        applyOperations(after, invertOperations(before, ops)),
        `seed ${seed}`,
      ).toEqual(JSON.parse(JSON.stringify(before)));
    }
  });
});
