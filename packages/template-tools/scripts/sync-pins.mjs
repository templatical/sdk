// Rewrites three release-time pins and bumps both skills' plugin manifests.
//
// Four independent jobs, run together because all four fire from the same
// root `changeset:version` step and each keeps something that ships outside
// this package in sync with it:
//
// 1. EDITOR_VERSION in src/live/index.ts, from @templatical/editor's own
//    version — the live harness's CDN pin. schema.json is generated from
//    @templatical/types, and types + editor bump in lockstep (changesets
//    fixed group), so this keeps the live editor's block model equal to the
//    schema's.
// 2. The CLI version pin in skills/templatical-email/SKILL.md, from this
//    package's OWN version — every `npx -y @templatical/template-tools@…`
//    invocation the skill documents. Pinning is what keeps
//    reference/schema.json from ever disagreeing with the published CLI's
//    block model, since a release moves both together.
// 3. The same CLI version pin, shown once more in the docs site
//    (apps/docs/guide/agent-skill.md + its de/ mirror), from the same
//    version. Governing rule: a *pinned* invocation is synced from here, in
//    lockstep with every other pin in this file; an invocation shown
//    deliberately unpinned — skills/templatical-email/README.md's
//    `npx -y @templatical/template-tools validate …`, with no `@version` at
//    all — is a "latest is fine" choice for a file nobody expects to track
//    the schema exactly, and must stay that way. Don't add a pin there.
// 4. A patch bump to EVERY skill's .claude-plugin/plugin.json — both
//    templatical-email and templatical-sdk. Claude Code caches an installed
//    plugin by that version, so a release that rewrites a file the plugin
//    ships needs a bump behind it or installed copies keep serving stale
//    content forever, and `plugin-version.yml` cannot catch it: that check
//    exempts Version Packages PRs, which is the only context this script
//    ever runs in. Both skills qualify. For templatical-email it is job 2's
//    SKILL.md pin rewrite, which sits outside that workflow's
//    tools/tests/evals denylist. For templatical-sdk it is the release step
//    that follows this one — `generate-reference` embeds
//    @templatical/editor's version in both reference/manifest.json and
//    SKILL.md's generated index, and editor shares this package's changesets
//    `fixed` group, so a release ALWAYS rewrites those two files whether or
//    not a docs page changed. Nothing else moves either number: changesets
//    skips both skills because their package.json is private.
//
// Runs at release time from the root `changeset:version` script (wired into
// changesets/action's `version` step), so the Version Packages PR carries all
// changes with no manual step. Also runnable by hand:
// `pnpm --filter @templatical/template-tools run sync-pins`.
//
// Each job fails loudly rather than silently matching nothing — a sync that
// no-ops on a missing target is worse than no sync at all, because the pin
// test then keeps passing on stale content right up until the release that
// needed it.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
// 2. The CLI version pin in skills/templatical-email/SKILL.md
// ---------------------------------------------------------------------------

const OWN_PKG = resolve(here, "../package.json");
const SKILL_MD_LABEL = "skills/templatical-email/SKILL.md";
const SKILL_MD = resolve(here, "../../../", SKILL_MD_LABEL);

// The fixed invocation prefix SKILL.md's Requirements section declares as
// canonical: `npx -y @templatical/template-tools@<version>`, identical for
// every command the skill documents. Global so every occurrence rewrites
// together — see the post-replace check below for what happens if it didn't.
// Reused as-is by job 3 below: the docs site quotes the exact same prefix.
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

/** Read this package's own version and rewrite every pin in SKILL.md. */
export function syncCliPin() {
  const version = JSON.parse(readFileSync(OWN_PKG, "utf8")).version;
  const src = readFileSync(SKILL_MD, "utf8");
  const { next, count } = applyCliPin(src, version);
  const changed = next !== src;
  if (changed) writeFileSync(SKILL_MD, next, "utf8");
  return { version, changed, count };
}

// ---------------------------------------------------------------------------
// 3. The same CLI pin, shown once more in the docs site
// ---------------------------------------------------------------------------

// Governing rule: anything showing a *pinned* invocation is synced from this
// file; an invocation shown deliberately unpinned is a "latest is fine"
// choice and must never gain a pin. skills/templatical-email/README.md
// quotes `npx -y @templatical/template-tools validate …` with no `@version`
// on purpose — it isn't in this list, and adding it here would be wrong.
const DOCS_CLI_PIN_TARGETS = [
  "apps/docs/guide/agent-skill.md",
  "apps/docs/de/guide/agent-skill.md",
].map((label) => ({ label, file: resolve(here, "../../../", label) }));

/**
 * Read this package's own version and rewrite the CLI pin in every docs
 * page that quotes it. Each file is synced independently through the same
 * applyCliPin used for SKILL.md, so a missing file, a missing pin, or a
 * partial rewrite in any one locale fails loudly on its own — the English
 * page rewriting cleanly says nothing about whether the German mirror did.
 */
export function syncDocsCliPins() {
  const version = JSON.parse(readFileSync(OWN_PKG, "utf8")).version;
  const results = DOCS_CLI_PIN_TARGETS.map(({ label, file }) => {
    const src = readFileSync(file, "utf8");
    const { next, count } = applyCliPin(src, version, label);
    const changed = next !== src;
    if (changed) writeFileSync(file, next, "utf8");
    return { label, changed, count };
  });
  return { version, results };
}

// ---------------------------------------------------------------------------
// 4. Patch-bump every skill's .claude-plugin/plugin.json
// ---------------------------------------------------------------------------

// Both plugins in the marketplace. templatical-sdk needs this every bit as
// much as templatical-email does, and for a sharper reason: its reference
// tree and SKILL.md both embed @templatical/editor's version, and editor is
// in the same changesets `fixed` group as this package — so a release moves
// that version, generate-reference rewrites both files, and an install with
// an unchanged manifest version would never refetch them.
const PLUGIN_MANIFESTS = ["templatical-email", "templatical-sdk"].map(
  (skill) => ({
    skill,
    path: resolve(here, `../../../skills/${skill}/.claude-plugin/plugin.json`),
  }),
);

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
  return PLUGIN_MANIFESTS.map(({ skill, path }) => {
    const { src, from, to } = applyPluginPatchBump(readFileSync(path, "utf8"));
    writeFileSync(path, src, "utf8");
    return { skill, from, to };
  });
}

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
      ? `Synced ${cli.count} CLI pin(s) in SKILL.md to ${cli.version}`
      : `${cli.count} CLI pin(s) in SKILL.md already ${cli.version} — no change`,
  );

  const docs = syncDocsCliPins();
  for (const { label, changed, count } of docs.results) {
    console.log(
      changed
        ? `Synced ${count} CLI pin(s) in ${label} to ${docs.version}`
        : `${count} CLI pin(s) in ${label} already ${docs.version} — no change`,
    );
  }

  // Unlike the pins above — which are idempotent once they already match
  // the workspace version — this always advances, on every run. The pins
  // answer "does this match reality"; the plugin bump answers "did anything
  // ship", and a release that touches SKILL.md or the docs with no version
  // drift at all (a docs-only or test-only change under this skill) still
  // needs installed plugins to refetch it. Collapsing this into a
  // no-op-when-unchanged check would silently reintroduce the exact failure
  // plugin-version.yml exists to catch. Don't "fix" this into idempotence.
  for (const { skill, from, to } of bumpPluginVersion()) {
    console.log(
      `Bumped ${skill} plugin version ${from} → ${to} so installed plugins pick up the change`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
