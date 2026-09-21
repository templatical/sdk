import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Immutable GitHub releases 422 any asset upload after the release is
 * published (`Cannot upload assets to an immutable release`). The tarballs
 * therefore have to be arguments to `gh release create` — gh drafts, uploads,
 * then publishes — not a follow-up `gh release upload` against a live
 * release. A leftover draft from a failed run is still mutable and must be
 * finished, not treated as "already exists".
 */
const PUBLISH_YML = readFileSync(
  join(import.meta.dirname, "../../../.github/workflows/publish.yml"),
  "utf8",
);

const CREATE_STEP = (() => {
  const start = PUBLISH_YML.indexOf("Create aggregated GitHub release");
  const end = PUBLISH_YML.indexOf("Trigger marketing-site rebuild");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return PUBLISH_YML.slice(start, end);
})();

describe("publish.yml attaches tarballs before the release is immutable", () => {
  it("passes packed tarballs as arguments to gh release create", () => {
    // Bound to the create invocation. A follow-up `gh release upload
    // "${ASSETS[@]}"` also contains that expansion, so a greedy match from
    // `create` through the rest of the step is vacuous.
    const create = CREATE_STEP.match(
      /gh release create "v\$VERSION" \\\n(?:[^\n]*\\\n)*[^\n]*/,
    );
    expect(create?.[0]).toContain('"${ASSETS[@]}"');
  });

  it("does not upload assets after publishing a new release", () => {
    const createAt = CREATE_STEP.indexOf('gh release create "v$VERSION"');
    const lastUploadAt = CREATE_STEP.lastIndexOf("gh release upload");
    expect(createAt).toBeGreaterThan(0);
    if (lastUploadAt !== -1) {
      expect(lastUploadAt).toBeLessThan(createAt);
      expect(CREATE_STEP).toContain("isDraft");
    }
  });

  it("finishes a leftover draft instead of treating any existing release as done", () => {
    expect(CREATE_STEP).toContain("--json isDraft");
    expect(CREATE_STEP).toContain("--draft=false");
  });
});
