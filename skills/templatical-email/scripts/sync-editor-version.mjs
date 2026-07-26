// Rewrites EDITOR_VERSION in scripts/live-server.mjs to match the repo's
// @templatical/editor version, so the live-mode CDN pin tracks the editor with
// no manual bump.
//
// Runs automatically at release time: the root `changeset:version` script
// (wired into changesets/action's `version` step) runs `changeset version`
// then this, so the Version Packages PR carries the bumped pin. Also runnable
// by hand: `pnpm --filter @templatical/email-skill run sync-editor-version`.
// tests/cdn-pin.test.ts is the safety net that fails CI if the two ever drift.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const EDITOR_PKG = resolve(here, "../../../packages/editor/package.json");
const LIVE_SERVER = resolve(here, "./live-server.mjs");
const PLUGIN_MANIFEST = resolve(here, "../.claude-plugin/plugin.json");

const EDITOR_VERSION_RE = /(export const EDITOR_VERSION = ")[^"]*(";)/;
const PLUGIN_VERSION_RE = /("version"\s*:\s*")([^"]*)(")/;

/** Pure: return `src` with its EDITOR_VERSION declaration set to `version`. */
export function applyEditorVersion(src, version) {
  if (!EDITOR_VERSION_RE.test(src)) {
    throw new Error(
      'Could not find the `export const EDITOR_VERSION = "…";` declaration in live-server.mjs',
    );
  }
  return src.replace(EDITOR_VERSION_RE, `$1${version}$2`);
}

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

/** Read the editor version, rewrite live-server.mjs in place if it changed. */
export function syncEditorVersion() {
  const version = JSON.parse(readFileSync(EDITOR_PKG, "utf8")).version;
  const src = readFileSync(LIVE_SERVER, "utf8");
  const next = applyEditorVersion(src, version);
  const changed = next !== src;
  if (changed) writeFileSync(LIVE_SERVER, next, "utf8");
  return { version, changed };
}

/**
 * Patch-bump the plugin's own version in .claude-plugin/plugin.json.
 *
 * A new EDITOR_VERSION changes what the live harness loads from the CDN — a
 * real behavior change — but Claude Code caches the plugin by the version in
 * plugin.json, so without a bump every existing install keeps serving the old
 * pin forever. Nothing else moves this number: changesets skips the skill
 * because its package.json is private, and .github/workflows/plugin-version.yml
 * exempts Version Packages PRs (they're generated, so no human is there to bump
 * it). Patch is the deliberate choice — the plugin's own surface didn't change,
 * only the editor it points at.
 */
export function bumpPluginVersion() {
  const { src, from, to } = applyPluginPatchBump(
    readFileSync(PLUGIN_MANIFEST, "utf8"),
  );
  writeFileSync(PLUGIN_MANIFEST, src, "utf8");
  return { from, to };
}

function main() {
  const { version, changed } = syncEditorVersion();
  if (!changed) {
    console.log(`EDITOR_VERSION already ${version} — no change`);
    return;
  }
  console.log(`Synced EDITOR_VERSION → ${version} in scripts/live-server.mjs`);
  const { from, to } = bumpPluginVersion();
  console.log(
    `Bumped plugin version ${from} → ${to} so installed plugins pick up the new pin`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
