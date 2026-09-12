import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// The release chain is the one part of this repo that CI never executes: it
// runs from `changeset:version`, which only ever fires inside changesets'
// own Version-Packages step. So a break in it passes every PR gate and
// surfaces when a real release is attempted, aborting the whole `fixed`
// group's publish. These tests stand in for that missing execution by
// asserting the chain's *shape* — what order it runs in, and that every step
// it names exists.

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SKILLS_DIR = resolve(REPO_ROOT, "skills");

describe("changeset:version step order", () => {
  const script: string = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"),
  ).scripts["changeset:version"];
  const segments = script.split("&&").map((s) => s.trim());

  it("runs `changeset version` first, so every later step reads bumped versions", () => {
    expect(segments[0]).toBe("changeset version");
  });

  it("names only scripts that exist in the package they filter to", () => {
    // A typo in a --filter target or a script rename aborts the whole
    // &&-joined chain at release time, blocking the entire fixed group.
    const invocations = [
      ...script.matchAll(/--filter (\S+) run ([\w:-]+)/g),
    ].map((m) => ({ pkg: m[1], script: m[2] }));
    expect(invocations.length).toBeGreaterThan(0);

    const workspaceManifests = [
      ...readdirSync(resolve(REPO_ROOT, "packages")).map((d) =>
        resolve(REPO_ROOT, "packages", d, "package.json"),
      ),
      ...readdirSync(resolve(REPO_ROOT, "apps")).map((d) =>
        resolve(REPO_ROOT, "apps", d, "package.json"),
      ),
      ...readdirSync(SKILLS_DIR).map((d) =>
        resolve(SKILLS_DIR, d, "package.json"),
      ),
    ];
    const byName = new Map<string, Record<string, string>>();
    for (const path of workspaceManifests) {
      try {
        const pkg = JSON.parse(readFileSync(path, "utf8"));
        byName.set(pkg.name, pkg.scripts ?? {});
      } catch {
        // Not every directory is a workspace member; skip it.
      }
    }

    const missing = invocations.filter(
      ({ pkg, script: name }) => !byName.get(pkg)?.[name],
    );
    expect(missing).toEqual([]);
  });
});
