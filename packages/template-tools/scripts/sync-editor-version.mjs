// Rewrites EDITOR_VERSION in src/live/index.ts to match the repo's
// @templatical/editor version, so the live harness's CDN pin tracks the editor
// with no manual bump. The pin matters because schema.json is generated from
// @templatical/types, and types + editor bump in lockstep (changesets fixed
// group) - so the editor at this version has the block model the schema
// describes, and a stale pin means the live editor and the validator disagree.
//
// Runs at release time from the root `changeset:version` script, so the Version
// Packages PR carries the bumped pin. tests/cdn-pin.test.ts is the safety net.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const EDITOR_PKG = resolve(here, "../../editor/package.json");
const LIVE_MODULE = resolve(here, "../src/live/index.ts");

// Built from parts, like tests/cdn-pin.test.ts's own DECLARATION_RE, so this
// file's source never self-matches that test's repo-wide scan for a second
// EDITOR_VERSION declaration — collapsing this back into one literal would
// make this script itself look like a duplicate declaration and fail CI.
const EDITOR_VERSION_RE = new RegExp(
  ["(export const EDITOR_VERSION", ' = ")[^"]*(";)'].join(""),
);

/** Pure: return `src` with its EDITOR_VERSION declaration set to `version`. */
export function applyEditorVersion(src, version) {
  if (!EDITOR_VERSION_RE.test(src)) {
    throw new Error(
      [
        "Could not find the `export const EDITOR_VERSION",
        ' = "…";` declaration in src/live/index.ts',
      ].join(""),
    );
  }
  return src.replace(EDITOR_VERSION_RE, `$1${version}$2`);
}

/** Read the editor version and rewrite src/live/index.ts if it changed. */
export function syncEditorVersion() {
  const version = JSON.parse(readFileSync(EDITOR_PKG, "utf8")).version;
  const src = readFileSync(LIVE_MODULE, "utf8");
  const next = applyEditorVersion(src, version);
  const changed = next !== src;
  if (changed) writeFileSync(LIVE_MODULE, next, "utf8");
  return { version, changed };
}

function main() {
  const { version, changed } = syncEditorVersion();
  console.log(
    changed
      ? `Synced EDITOR_VERSION to ${version} in src/live/index.ts`
      : `EDITOR_VERSION already ${version} - no change`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
