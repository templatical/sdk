// Rewrites the release-time version pins that live outside this package.
//
// Two independent jobs, run together because both fire from the same root
// `changeset:version` step and each keeps something that ships outside this
// package in sync with it:
//
// 1. EDITOR_VERSION in src/live/index.ts, from @templatical/editor's own
//    version — the live harness's CDN pin. schema.json is generated from
//    @templatical/types, and types + editor bump in lockstep (changesets
//    fixed group), so this keeps the live editor's block model equal to the
//    schema's.
// 2. The CLI version pin across every reference island under
//    skills/templatical/, from this package's OWN version — every
//    `npx -y @templatical/template-tools@…` invocation any island documents.
//    Pinning is what keeps reference/schema.json from ever disagreeing with
//    the published CLI's block model, since a release moves both together.
// Runs at release time from the root `changeset:version` script (wired into
// changesets/action's `version` step), so the Version Packages PR carries all
// changes with no manual step. Also runnable by hand:
// `pnpm --filter @templatical/template-tools run sync-pins`.
//
// Each job fails loudly rather than silently matching nothing — a sync that
// no-ops on a missing target is worse than no sync at all, because the pin
// test then keeps passing on stale content right up until the release that
// needed it.
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 1. EDITOR_VERSION in src/live/index.ts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 2. The CLI version pin across every reference island under skills/templatical/
// ---------------------------------------------------------------------------

const OWN_PKG = resolve(here, "../package.json");
// applyCliPin's fallback label when a caller omits one. Every real caller
// below passes its own label explicitly (syncCliPin per island
// per docs page), so this only surfaces if applyCliPin is ever called
// directly without one.
const SKILL_MD_LABEL = "skills/templatical/SKILL.md";

// The fixed invocation prefix every reference island's Requirements section
// declares as canonical: `npx -y @templatical/template-tools@<version>`,
// identical for every command any island documents. Global so every
// occurrence rewrites together — see the post-replace check below for what
// happens if it didn't. Reused as-is by job 3 below: the docs site quotes the
// exact same prefix.
const CLI_PIN_RE = /(npx -y @templatical\/template-tools@)(\S+)/g;

/**
 * Pure: return `src` with every CLI pin rewritten to `version`, plus how many
 * occurrences were found. `label` names the file in both error messages —
 * shared by every file this regex is applied to, so the error always points
 * at the file that actually broke rather than always saying "SKILL.md".
 * Throws if none are found (nothing to sync means the pin mechanism itself
 * broke, not that there's no work to do) and, after rewriting, throws again
 * if any occurrence still disagrees with `version` — the second check is
 * what catches a regression to this regex (e.g. losing the `g` flag) that
 * would otherwise rewrite only the first occurrence and leave the rest
 * silently stale.
 */
export function applyCliPin(src, version, label = SKILL_MD_LABEL) {
  const before = [...src.matchAll(CLI_PIN_RE)];
  if (before.length === 0) {
    throw new Error(
      "Could not find any `npx -y @templatical/template-tools@<version>` " +
        `invocation in ${label}`,
    );
  }
  const next = src.replace(CLI_PIN_RE, `$1${version}`);
  const after = [...next.matchAll(CLI_PIN_RE)];
  const stale = after.filter((match) => match[2] !== version);
  if (stale.length > 0) {
    throw new Error(
      `Rewrote ${after.length - stale.length} of ${before.length} CLI pin(s) in ` +
        `${label}, but ${stale.length} still read a different version. This ` +
        "means CLI_PIN_RE stopped matching every occurrence (e.g. lost its " +
        "`g` flag) — fix the regex, don't paper over the count.",
    );
  }
  return { next, count: before.length };
}

const SKILL_DIR_LABEL = "skills/templatical";
const SKILL_DIR = resolve(here, "../../../", SKILL_DIR_LABEL);

/**
 * Every `.md` under the skill, repo-relative, `/`-joined. Exported so
 * tests/sync-pins.test.ts can assert directly on what the walk finds.
 *
 * Two independent defenses against pulling in vendor `.md` files, not one:
 * `lstatSync`, not `statSync`, so a symlinked entry (e.g. a pnpm-managed
 * package inside `node_modules`) is never followed — the symlink itself
 * isn't a directory, so the walk doesn't descend into it. And `node_modules`
 * is skipped by name regardless, because `node_modules` is a real directory
 * under every workspace member; whether the packages inside it are symlinks
 * is an installer detail. `lstatSync` alone would exclude them today only
 * because pnpm happens to symlink each package — a different installer
 * layout, or pnpm hoisting a real directory in there, would put vendor
 * README/LICENSE/SECURITY `.md` files back in the walk, and applyCliPin
 * would be handed files it has no business seeing. The name skip makes the
 * exclusion structural instead of incidental to today's installer.
 */
export function skillMarkdownFiles(dir = SKILL_DIR, base = SKILL_DIR) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const abs = join(dir, entry);
    if (lstatSync(abs).isDirectory()) {
      out.push(...skillMarkdownFiles(abs, base));
      continue;
    }
    if (entry.endsWith(".md")) {
      out.push(`${SKILL_DIR_LABEL}/${relative(base, abs).split(sep).join("/")}`);
    }
  }
  return out;
}

/**
 * Rewrite every CLI pin across the skill. Files with no pin are skipped
 * rather than passed to applyCliPin, which throws on zero matches — under a
 * router most islands legitimately document no command at all. The
 * "mechanism broke" guarantee moves up one level: the tree as a whole must
 * still carry at least one pin.
 */
export function syncCliPin() {
  const version = JSON.parse(readFileSync(OWN_PKG, "utf8")).version;
  let count = 0;
  let changed = false;
  for (const label of skillMarkdownFiles()) {
    const path = resolve(here, "../../../", label);
    const src = readFileSync(path, "utf8");
    if (!src.includes("npx -y @templatical/template-tools@")) continue;
    const result = applyCliPin(src, version, label);
    count += result.count;
    if (result.next !== src) {
      writeFileSync(path, result.next, "utf8");
      changed = true;
    }
  }
  if (count === 0) {
    throw new Error(
      `No \`npx -y @templatical/template-tools@<version>\` invocation anywhere under ` +
        `${SKILL_DIR_LABEL}. The pin mechanism is broken, not idle.`,
    );
  }
  return { version, changed, count };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function main() {
  const editor = syncEditorVersion();
  console.log(
    editor.changed
      ? `Synced EDITOR_VERSION to ${editor.version} in src/live/index.ts`
      : `EDITOR_VERSION already ${editor.version} — no change`,
  );

  const cli = syncCliPin();
  console.log(
    cli.changed
      ? `Synced ${cli.count} CLI pin(s) across the skill's islands to ${cli.version}`
      : `${cli.count} CLI pin(s) across the skill's islands already ${cli.version} — no change`,
  );

}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
