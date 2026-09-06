// Generates skills/templatical-sdk/reference/ — a verbatim, hash-manifested
// copy of the English docs — and rewrites SKILL.md's generated index.
//
// Page collection is NOT reimplemented here. `collectPages` (which pages
// exist, which are excluded, and enforcement of a frontmatter description on
// every one) and `renderIndex` (group ordering) are imported from the docs
// site's own generator, so this skill's router and docs.templatical.com's
// llms.txt can never disagree about what a page is for — see
// design-notes/sdk-skill-plan.md §1 ruling 1.
//
// Freshness is internal consistency, not a comparison against apps/docs at
// HEAD: reference/manifest.json records a sha256 per file plus the SDK
// version the copy was made from, and a test asserts hashes match and
// SKILL.md cites the same version (design-notes/sdk-skill.md §5.2). Docs
// change on nearly every feature PR in this repo; a HEAD comparison would
// fail CI on every docs typo until this tree was regenerated. Regeneration
// instead runs once per release, from the root `changeset:version` script.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectPages,
  renderIndex,
} from "../../../apps/docs/scripts/build-agent-surface.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HERE, "..");
const REPO_ROOT = join(SKILL_ROOT, "..", "..");
const DOCS_DIR = join(REPO_ROOT, "apps", "docs");
const REFERENCE_DIR = join(SKILL_ROOT, "reference");
const SKILL_MD = join(SKILL_ROOT, "SKILL.md");
const PLUGIN_MANIFEST = join(SKILL_ROOT, ".claude-plugin", "plugin.json");

const BEGIN_MARKER = "<!-- BEGIN GENERATED INDEX -->";
const END_MARKER = "<!-- END GENERATED INDEX -->";

function readSdkVersion() {
  const pkgPath = join(REPO_ROOT, "packages", "editor", "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf8")).version;
}

function readPluginDescription() {
  return JSON.parse(readFileSync(PLUGIN_MANIFEST, "utf8")).description;
}

function sortObjectKeys(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return sorted;
}

/** Every `.md` file currently under `dir`, relative to `dir`, `/`-joined. */
function listMarkdownFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      listMarkdownFiles(abs, base, out);
      continue;
    }
    if (entry.endsWith(".md")) {
      out.push(relative(base, abs).split(sep).join("/"));
    }
  }
  return out;
}

/** Removes now-empty directories under (but not including) `dir`. */
function pruneEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      pruneEmptyDirs(abs);
      if (readdirSync(abs).length === 0) rmdirSync(abs);
    }
  }
}

/**
 * Deletes reference/ pages that no longer correspond to a source doc, before
 * anything is copied. Without this a renamed or removed docs page leaves an
 * orphan in reference/ that nothing ever cleans up — the freshness test only
 * checks that committed files match their manifest entries, so an orphan
 * with a stale-but-self-consistent hash would pass forever.
 */
function removeOrphanedPages(referenceDir, expectedRelPaths) {
  const removed = [];
  for (const rel of listMarkdownFiles(referenceDir)) {
    if (!expectedRelPaths.has(rel)) {
      unlinkSync(join(referenceDir, rel));
      removed.push(rel);
    }
  }
  pruneEmptyDirs(referenceDir);
  return removed.sort();
}

/**
 * Group display order, matching the docs' own llms.txt exactly. Derived by
 * calling B's exported `renderIndex` and reading back the `## ` headings it
 * emits, rather than duplicating its private (unexported) GROUP_ORDER —
 * duplicating it would let the two indexes' group ordering drift silently
 * the next time a group is added or reordered upstream. Every group present
 * in `pages` is guaranteed to appear: renderIndex's internal grouping emits
 * every group it sees in `pages`, known ones in GROUP_ORDER's order followed
 * by any unknown ones alphabetically.
 */
function deriveGroupOrder(pages, sdkVersion) {
  const rendered = renderIndex(pages, { version: sdkVersion });
  return [...rendered.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
}

function renderGeneratedIndexBody(pages, sdkVersion) {
  const groupOrder = deriveGroupOrder(pages, sdkVersion);
  const byGroup = new Map();
  for (const page of pages) {
    if (!byGroup.has(page.group)) byGroup.set(page.group, []);
    byGroup.get(page.group).push(page);
  }

  const lines = [
    `_Generated from \`@templatical/editor@${sdkVersion}\` — ${pages.length} pages. ` +
      "Regenerate with `pnpm --filter @templatical/sdk-skill run generate-reference` " +
      "(wired into the release's `changeset:version` step)._",
    "",
  ];
  for (const group of groupOrder) {
    const groupPages = byGroup.get(group);
    if (!groupPages || groupPages.length === 0) continue;
    lines.push(`## ${group}`, "");
    for (const page of groupPages) {
      lines.push(`- [${page.title}](reference/${page.path}): ${page.description}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function yamlSingleQuoted(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * A minimal SKILL.md so the marker-rewrite below has a file to write into on
 * a fresh checkout. The description is read from plugin.json rather than
 * duplicated here, so the trigger text can't drift between the two the day
 * this file is created. Everything outside the markers is hand-written from
 * here on — design-notes/sdk-skill-plan.md Task 3 replaces this placeholder
 * body; this generator never touches anything outside the markers again
 * once the file exists.
 */
function buildPlaceholderSkillMd() {
  return (
    [
      "---",
      "name: templatical-sdk",
      `description: ${yamlSingleQuoted(readPluginDescription())}`,
      "---",
      "",
      "_The content below this line is written by a later task " +
        "(design-notes/sdk-skill-plan.md, Task 3)._",
      "",
      BEGIN_MARKER,
      END_MARKER,
    ].join("\n") + "\n"
  );
}

/**
 * Replaces the content between the two markers, creating a minimal SKILL.md
 * first if none exists yet. Fails loudly — rather than appending somewhere
 * guessed — when an existing file is missing either marker, since a file
 * with hand-written content but a mangled marker is a sign something broke
 * the file, not a place to silently improvise.
 */
function rewriteGeneratedIndex(skillMdPath, generatedBody) {
  let content;
  let createdPlaceholder = false;
  if (!existsSync(skillMdPath)) {
    content = buildPlaceholderSkillMd();
    createdPlaceholder = true;
  } else {
    content = readFileSync(skillMdPath, "utf8");
  }

  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  const missing = [];
  if (beginIdx === -1) missing.push(BEGIN_MARKER);
  if (endIdx === -1) missing.push(END_MARKER);
  if (missing.length > 0) {
    throw new Error(
      `SKILL.md is missing ${missing.join(" and ")}. The generated index is only ever ` +
        "rewritten between both markers — restore them (they may sit adjacent, with " +
        "nothing between) rather than expecting the generator to guess where it goes.",
    );
  }
  if (endIdx < beginIdx) {
    throw new Error(`SKILL.md has ${END_MARKER} before ${BEGIN_MARKER} — markers are out of order.`);
  }

  const before = content.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = content.slice(endIdx);
  writeFileSync(skillMdPath, `${before}\n\n${generatedBody}\n\n${after}`);
  return createdPlaceholder;
}

/**
 * Regenerates reference/, reference/manifest.json and SKILL.md's generated
 * index. Copies are byte-identical: pages are read and written as raw
 * buffers (never reconstructed from `collectPages()`'s parsed `body`, which
 * has its frontmatter stripped and content trimmed) — a transform here would
 * be a second voice to maintain, and the spec rejects condensing outright.
 */
export function generateReference() {
  const pages = [...collectPages()].sort((a, b) => a.path.localeCompare(b.path));
  const sdkVersion = readSdkVersion();

  mkdirSync(REFERENCE_DIR, { recursive: true });
  const expectedRelPaths = new Set(pages.map((p) => p.path));
  const removedOrphans = removeOrphanedPages(REFERENCE_DIR, expectedRelPaths);

  const fileHashes = {};
  for (const page of pages) {
    const srcAbs = join(DOCS_DIR, page.path);
    const destAbs = join(REFERENCE_DIR, page.path);
    mkdirSync(dirname(destAbs), { recursive: true });
    const raw = readFileSync(srcAbs);
    writeFileSync(destAbs, raw);
    fileHashes[page.path] = createHash("sha256").update(raw).digest("hex");
  }

  const manifest = {
    sdkVersion,
    pageCount: pages.length,
    files: sortObjectKeys(fileHashes),
  };
  writeFileSync(
    join(REFERENCE_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const generatedBody = renderGeneratedIndexBody(pages, sdkVersion);
  const createdPlaceholder = rewriteGeneratedIndex(SKILL_MD, generatedBody);

  return { pageCount: pages.length, sdkVersion, createdPlaceholder, removedOrphans };
}

function main() {
  try {
    const result = generateReference();
    const notes = [];
    if (result.createdPlaceholder) notes.push("created SKILL.md placeholder");
    if (result.removedOrphans.length > 0) {
      notes.push(`removed ${result.removedOrphans.length} orphaned page(s): ${result.removedOrphans.join(", ")}`);
    }
    const suffix = notes.length > 0 ? ` (${notes.join("; ")})` : "";
    process.stdout.write(
      `Wrote reference/ (${result.pageCount} pages, SDK ${result.sdkVersion}) and SKILL.md's generated index${suffix}\n`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
