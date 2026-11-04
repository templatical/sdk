import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowDir = join(import.meta.dirname, "../../../.github/workflows");
const expectedGate =
  "${{ (github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.head_ref, 'changeset-release/')) || startsWith(github.ref_name, 'changeset-release/') }}";

const definitions = readdirSync(workflowDir)
  .filter((file) => /\.ya?ml$/.test(file))
  .flatMap((file) =>
    [
      ...readFileSync(join(workflowDir, file), "utf8").matchAll(
        /^\s*IS_VP:\s*(.+)$/gm,
      ),
    ].map(([, expression]) => ({ file, expression: expression.trim() })),
  );

describe("Version Packages CI gate", () => {
  it("requires a same-repository head for every release-branch PR", () => {
    expect(definitions.length).toBe(9);
    for (const { file, expression } of definitions) {
      expect({ file, expression }).toEqual({ file, expression: expectedGate });
    }
  });

  it("uses the same gate in every workflow job", () => {
    expect([
      ...new Set(definitions.map(({ expression }) => expression)),
    ]).toEqual([expectedGate]);
  });
});
