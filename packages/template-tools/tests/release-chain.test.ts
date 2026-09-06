import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// The release chain is the one part of this repo that CI never executes: it
// runs from `changeset:version`, which only ever fires inside changesets'
// own Version-Packages step. So a break in it passes every PR gate and
// surfaces when a real release is attempted, aborting the whole `fixed`
// group's publish. These tests stand in for that missing execution by
// asserting the chain's *shape* — who it covers, what order it runs in, and
// that the cross-package edges it depends on still resolve.

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SKILLS_DIR = resolve(REPO_ROOT, "skills");
const SYNC_PINS = resolve(import.meta.dirname, "../scripts/sync-pins.mjs");

/** Every skill that ships a plugin manifest, read off disk. */
function skillsWithAPluginManifest(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((skill) => {
      try {
        readFileSync(
          resolve(SKILLS_DIR, skill, ".claude-plugin/plugin.json"),
          "utf8",
        );
        return true;
      } catch {
        return false;
      }
    })
    .sort();
}

describe("sync-pins covers every plugin manifest", () => {
  it("bumps every skill that ships one, not a hand-picked subset", () => {
    // Claude Code caches an installed plugin by the version in its manifest,
    // and `plugin-version.yml` — the check that would otherwise catch a
    // missing bump — exempts Version Packages PRs, which is the only context
    // sync-pins runs in. So a skill left out here ships rewritten content to
    // new installs forever while existing installs stay frozen on stale
    // content under an unchanged version string.
    //
    // Derived from the filesystem rather than compared against a literal
    // list: a third skill added later fails this until sync-pins learns
    // about it, which a hardcoded expectation could not do.
    const onDisk = skillsWithAPluginManifest();
    expect(onDisk.length).toBeGreaterThan(1);

    const source = readFileSync(SYNC_PINS, "utf8");
    const covered = onDisk.filter((skill) =>
      new RegExp(`"${skill}"`).test(source),
    );
    expect(covered).toEqual(onDisk);
  });
});

describe("changeset:version step order", () => {
  const script: string = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"),
  ).scripts["changeset:version"];
  const segments = script.split("&&").map((s) => s.trim());

  it("regenerates the sdk skill's reference tree AFTER sync-pins", () => {
    // generate-reference copies apps/docs/guide/agent-skill.md verbatim into
    // the skill's reference tree, and sync-pins rewrites the CLI pin inside
    // that exact page. Reversed, a release commits a stale pin into the
    // committed copy — and nothing else would notice, because the skill's
    // freshness test only checks the tree against its own manifest.
    const syncPins = segments.findIndex((s) => s.includes("sync-pins"));
    const generateReference = segments.findIndex((s) =>
      s.includes("generate-reference"),
    );
    expect(syncPins).toBeGreaterThanOrEqual(0);
    expect(generateReference).toBeGreaterThan(syncPins);
  });

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

describe("the sdk skill's generator still resolves its docs-site imports", () => {
  it("imports names that apps/docs actually exports", async () => {
    // skills/templatical-sdk/tools/generate-reference.mjs reaches into
    // apps/docs/scripts/build-agent-surface.mjs by relative path, so the
    // router and llms.txt cannot disagree about what a page is for. Nothing
    // type-checks that edge: skills/* is outside the root typecheck glob,
    // and the generator only runs at release. A rename on the docs side
    // would otherwise break the release and nothing before it.
    const generator = readFileSync(
      resolve(SKILLS_DIR, "templatical-sdk/tools/generate-reference.mjs"),
      "utf8",
    );
    const importBlock = /import\s*\{([^}]+)\}\s*from\s*"([^"]*build-agent-surface\.mjs)"/.exec(
      generator,
    );
    expect(importBlock).not.toBeNull();

    const names = importBlock![1]
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    expect(names.length).toBeGreaterThan(0);

    const docsModule = await import(
      resolve(REPO_ROOT, "apps/docs/scripts/build-agent-surface.mjs")
    );
    const unresolved = names.filter(
      (name) => typeof docsModule[name] !== "function",
    );
    expect(unresolved).toEqual([]);
  });
});
