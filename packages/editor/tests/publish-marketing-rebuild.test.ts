import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * templatical.com bakes the homepage pill from unpkg's unversioned
 * `bundle-stats.json` at its own SSG build. `publish.yml` fires that rebuild
 * after npm publish; firing before unpkg's 302 cache points at the new
 * version bakes the previous numbers. The wait has to use that same URL,
 * with no cache-bust, and it has to finish before the deploy-hook POST.
 */
const PUBLISH_YML = readFileSync(
  join(import.meta.dirname, "../../../.github/workflows/publish.yml"),
  "utf8",
);

describe("publish.yml waits for unpkg before the marketing rebuild", () => {
  const STATS_URL =
    "https://unpkg.com/@templatical/editor/dist/bundle-stats.json";

  it("polls the same unversioned unpkg URL the marketing site fetches", () => {
    expect(PUBLISH_YML).toContain(STATS_URL);
    expect(PUBLISH_YML).not.toMatch(/bundle-stats\.json\?/);
  });

  it("POSTs the deploy hook only after that wait", () => {
    const waitAt = PUBLISH_YML.indexOf("STATS_URL=");
    const hookAt = PUBLISH_YML.lastIndexOf(
      'curl -fsSL -X POST "$DEPLOY_HOOK"',
    );
    expect(waitAt).toBeGreaterThan(0);
    expect(hookAt).toBeGreaterThan(waitAt);
  });
});
