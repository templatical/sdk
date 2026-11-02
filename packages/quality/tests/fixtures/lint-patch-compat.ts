import type { LintPatch } from "../../src/types";

export interface ExtendedPatch extends LintPatch {
  label: string;
}

export const legacyRemoval: LintPatch = {
  description: "Remove the empty block",
  apply: ({ removeBlock }) => removeBlock("empty"),
};
