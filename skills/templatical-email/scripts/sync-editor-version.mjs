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

const EDITOR_VERSION_RE = /(export const EDITOR_VERSION = ")[^"]*(";)/;

/** Pure: return `src` with its EDITOR_VERSION declaration set to `version`. */
export function applyEditorVersion(src, version) {
  if (!EDITOR_VERSION_RE.test(src)) {
    throw new Error(
      'Could not find the `export const EDITOR_VERSION = "…";` declaration in live-server.mjs',
    );
  }
  return src.replace(EDITOR_VERSION_RE, `$1${version}$2`);
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

function main() {
  const { version, changed } = syncEditorVersion();
  console.log(
    changed
      ? `Synced EDITOR_VERSION → ${version} in scripts/live-server.mjs`
      : `EDITOR_VERSION already ${version} — no change`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
