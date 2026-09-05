// Patch-bumps the plugin's own version in .claude-plugin/plugin.json.
//
// Runs automatically at release time: the root `changeset:version` script
// (wired into changesets/action's `version` step) runs `changeset version`
// then this, so the Version Packages PR carries the bump. Also runnable by
// hand: `pnpm --filter @templatical/email-skill run sync-editor-version`.
//
// This is the skill's own copy of the bump logic — the CLI-version pin this
// skill documents lives in SKILL.md and is synced by
// `packages/template-tools/scripts/sync-pins.mjs`, which is also where this
// file's bump logic is headed. Until that lands, this script is what keeps
// `.claude-plugin/plugin.json` moving so `plugin-version.yml` (a required
// check on any user-facing change here) stays satisfiable.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PLUGIN_MANIFEST = resolve(here, "../.claude-plugin/plugin.json");

const PLUGIN_VERSION_RE = /("version"\s*:\s*")([^"]*)(")/;

/** Pure: "0.2.0" -> "0.2.1". Throws on anything that isn't plain x.y.z. */
export function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  if (!match) {
    throw new Error(
      `Expected a plain x.y.z plugin version, got ${JSON.stringify(version)} — bump it by hand.`,
    );
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

/**
 * Pure: return `src` (raw plugin.json text) with its `version` patch-bumped.
 * Rewrites the string in place rather than re-serializing, so formatting and
 * key order survive.
 */
export function applyPluginPatchBump(src) {
  const match = PLUGIN_VERSION_RE.exec(src);
  if (!match) {
    throw new Error('Could not find a `"version": "…"` field in plugin.json');
  }
  const next = bumpPatch(match[2]);
  return { src: src.replace(PLUGIN_VERSION_RE, `$1${next}$3`), from: match[2], to: next };
}

/**
 * Patch-bump the plugin's own version in .claude-plugin/plugin.json.
 *
 * Claude Code caches an installed plugin by the version in plugin.json, so a
 * user-facing change to the skill needs this bumped or existing installs keep
 * serving the old content forever. Nothing else moves this number: changesets
 * skips the skill because its package.json is private, and
 * .github/workflows/plugin-version.yml exempts Version Packages PRs (they're
 * generated, so no human is there to bump it by hand).
 */
export function bumpPluginVersion() {
  const { src, from, to } = applyPluginPatchBump(
    readFileSync(PLUGIN_MANIFEST, "utf8"),
  );
  writeFileSync(PLUGIN_MANIFEST, src, "utf8");
  return { from, to };
}

async function main() {
  // The pin this script used to sync (the live-mode CDN editor version) and
  // the vendor bundles it used to re-stamp are both gone from this skill —
  // this run's only remaining job is the plugin bump, so it always runs.
  const { from, to } = bumpPluginVersion();
  console.log(
    `Bumped plugin version ${from} → ${to} so installed plugins pick up the change`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
