import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A peer range states the oldest version a consumer may bring. The global
 * `rangeStrategy: "bump"` raises a range to the newest release even when that
 * release already satisfies it, so on a peer it moves the floor: ai-kit's
 * `"ai": "^7"` became `"^7.0.148"`, which fails ai-kit's package-shape test
 * and would make every consumer upgrade to that patch. Peers widen instead.
 * A rule that sets another strategy and can match a peer would override it,
 * so the widen rule must be the only one.
 */
const RENOVATE = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../renovate.json"), "utf8"),
) as { packageRules: Array<Record<string, unknown>> };

describe("renovate.json keeps peer dependency floors", () => {
  it("widens peerDependencies, and no other rule sets their range strategy", () => {
    const forPeers = RENOVATE.packageRules.filter((rule) => {
      if (!("rangeStrategy" in rule)) return false;
      const depTypes = rule.matchDepTypes as string[] | undefined;
      return depTypes === undefined || depTypes.includes("peerDependencies");
    });
    expect(forPeers).toEqual([
      {
        description: expect.any(String),
        matchDepTypes: ["peerDependencies"],
        rangeStrategy: "widen",
      },
    ]);
  });
});
