import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every @templatical.com address published in tracked source must be a mailbox
 * that exists. The domain is on iCloud+ Custom Email Domain, which allows
 * **three addresses per domain** — so this is a closed set, not a list that
 * grows on demand: `orkhan@` (outbound only, never published), `hi@` and
 * `security@` fill it.
 *
 * Adding a fourth published address therefore means retiring one of these
 * first. Create the mailbox, then widen LIVE — never the other way round: the
 * repo shipped `licensing@`, `sales@`, `hello@` and `conduct@` for months with
 * no mailbox behind any of them, and a bouncing SECURITY.md contact means a
 * real report is abandoned or disclosed publicly.
 */

const REPO = join(import.meta.dirname, "../../..");

const LIVE = new Set(["hi@templatical.com", "security@templatical.com"]);

const ADDRESS = /[a-zA-Z0-9._-]+@templatical\.com/g;

function publishedAddresses(): Map<string, string[]> {
  const out = execFileSync(
    "git",
    ["grep", "-nIoE", ADDRESS.source, "--", ":!*node_modules*"],
    { cwd: REPO, encoding: "utf8" },
  );

  const found = new Map<string, string[]>();
  for (const line of out.split("\n").filter(Boolean)) {
    // git grep -o prints `path:lineno:match`; the match is the last field, and
    // a path cannot contain ':' here so a plain split is safe.
    const parts = line.split(":");
    const address = parts[parts.length - 1];
    const where = `${parts[0]}:${parts[1]}`;
    found.set(address, [...(found.get(address) ?? []), where]);
  }
  return found;
}

describe("published contact addresses", () => {
  it("publishes only addresses that have a mailbox", () => {
    const found = publishedAddresses();
    const dead = [...found.entries()]
      .filter(([address]) => !LIVE.has(address))
      .map(([address, where]) => `${address} (${where.join(", ")})`);

    expect(dead).toEqual([]);
  });

  // Positive control: if the scan or the regex breaks, the assertion above
  // passes on an empty set and stops guarding anything.
  it("actually finds the addresses it is guarding", () => {
    const found = publishedAddresses();

    expect(found.has("security@templatical.com")).toBe(true);
    expect(found.get("security@templatical.com")).toContain("SECURITY.md:21");
    expect(found.has("hi@templatical.com")).toBe(true);
    expect([...found.keys()].sort()).toEqual([...LIVE].sort());
  });

  it("keeps the set closed at the three iCloud+ addresses", () => {
    // orkhan@ is the third; it is outbound-only and must stay unpublished, so
    // LIVE carries two. A fourth entry here means the cap was exceeded.
    expect(LIVE.size).toBeLessThanOrEqual(2);
  });
});
