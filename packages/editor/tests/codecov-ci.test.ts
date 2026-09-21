import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The README coverage badge is Codecov's live SVG. CI can report a successful
 * upload while Codecov never processes it (repo deactivated, token rejected),
 * and the badge then sits on a stale percentage indefinitely. Failing the
 * test job on an upload error is the only signal that the badge has gone
 * stale. Locked against `fail_ci_if_error: false` (or omitting the key —
 * the action defaults to not failing).
 */
const CI_YML = readFileSync(
  join(import.meta.dirname, "../../../.github/workflows/ci.yml"),
  "utf8",
);

describe("ci.yml fails the test job when Codecov upload errors", () => {
  it("sets fail_ci_if_error: true on codecov-action", () => {
    const codecov = CI_YML.slice(CI_YML.indexOf("codecov/codecov-action"));
    expect(codecov).toMatch(/fail_ci_if_error:\s*true/);
    expect(codecov).not.toMatch(/fail_ci_if_error:\s*false/);
  });
});
