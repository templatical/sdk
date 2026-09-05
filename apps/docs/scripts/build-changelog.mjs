#!/usr/bin/env node
/**
 * Aggregates the ten per-package `packages/<name>/CHANGELOG.md` files into one
 * product changelog.
 *
 * The packages sit in a changesets `fixed` group (see `.changeset/config.json`),
 * so they always bump to the same version — there is one release timeline, split
 * ten ways. Each changeset writes its prose into the changelog of every package
 * it names, and writes a dependency-bump stub into the rest of the group:
 *
 *     - Updated dependencies [90f088e]     <- stub, carries no prose
 *       - @templatical/types@0.20.0        <- stub child
 *     - @templatical/quality@0.20.0        <- bare stub, no `Updated dependencies` parent
 *     - 90f088e: Add per-field colour …    <- the real entry
 *
 * Every top-level bullet in every changelog is exactly one of those three shapes,
 * so aggregation is mechanical: keep the `<hash>: <prose>` bullets, drop the
 * stubs, and dedupe by commit hash. The set of packages that carried a hash as
 * real prose is that entry's attribution — it does not have to be inferred.
 *
 * Outputs (both committed, so the docs build and the release step never have to
 * run this):
 *   - `apps/docs/changelog.md`            the rendered docs page
 *   - `apps/docs/public/changelog.json`   machine-readable, served at
 *                                         docs.templatical.com/changelog.json and
 *                                         read by templatical.com at SSG build time
 *
 * Usage:
 *   node apps/docs/scripts/build-changelog.mjs                  write both outputs
 *   node apps/docs/scripts/build-changelog.mjs --check          exit 1 if stale
 *   node apps/docs/scripts/build-changelog.mjs --release-notes 0.20.0
 *                                                               print one version
 *                                                               to stdout
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..", "..");
const DOCS_DIR = join(REPO_ROOT, "apps", "docs");
const MARKDOWN_OUT = join(DOCS_DIR, "changelog.md");
const JSON_OUT = join(DOCS_DIR, "public", "changelog.json");

const LEVEL_RANK = { patch: 0, minor: 1, major: 2 };

/**
 * A bullet whose entire content is a `pkg@version` reference — changesets'
 * dependency-bump stub. It appears both at column 0 and indented under a real
 * entry (with no `Updated dependencies` parent), so it has to be filtered while
 * collecting an entry's continuation lines as well as at the bullet level.
 */
const STUB_LINE = /^\s*-\s+(?:@[a-z0-9-]+\/)?[a-z0-9-]+@\d\S*\s*$/;

/** Section label per bump level, in the order they render within a version. */
const LEVEL_SECTIONS = [
  ["major", "Breaking changes"],
  ["minor", "Features"],
  ["patch", "Fixes and improvements"],
];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parses one package's CHANGELOG.md.
 *
 * Only column-0 `##` / `###` / `- ` count as structure. Entry bodies are indented
 * two spaces by changesets and may contain their own `##` headings and nested
 * lists, so indentation — not content — is what separates a continuation line
 * from the next entry.
 *
 * @param {string} source
 * @param {string} fallbackName used when the file has no `# <name>` title
 * @returns {{ pkgName: string, versions: Array<{version: string, entries: Array<{hash: string, level: string, lines: string[]}>}> }}
 */
export function parsePackageChangelog(source, fallbackName = "") {
  const lines = source.split(/\r?\n/);
  const title = lines.find((l) => l.startsWith("# "));
  const pkgName = title ? title.slice(2).trim() : fallbackName;

  const versions = [];
  let currentVersion = null;
  let level = null;
  let entry = null;

  const flushEntry = () => {
    if (entry && currentVersion) {
      // Trailing blanks are separators from the source file, not body content.
      while (entry.lines.length > 0 && entry.lines.at(-1) === "") entry.lines.pop();
      currentVersion.entries.push(entry);
    }
    entry = null;
  };

  for (const line of lines) {
    const versionMatch = /^## +(.+?) *$/.exec(line);
    if (versionMatch) {
      flushEntry();
      currentVersion = { version: versionMatch[1], entries: [] };
      versions.push(currentVersion);
      level = null;
      continue;
    }

    const sectionMatch = /^### +(Major|Minor|Patch) Changes *$/.exec(line);
    if (sectionMatch) {
      flushEntry();
      level = sectionMatch[1].toLowerCase();
      continue;
    }

    if (line.startsWith("- ")) {
      flushEntry();
      const hashMatch = /^- ([0-9a-f]{7,40}): ?(.*)$/.exec(line);
      // Anything else at this indentation is a dependency-bump stub — skipping it
      // leaves `entry` null, so its indented children are skipped too.
      if (hashMatch && level && currentVersion) {
        entry = { hash: hashMatch[1], level, lines: [hashMatch[2]] };
      }
      continue;
    }

    if (entry) {
      if (line.trim() === "") entry.lines.push("");
      else if (line.startsWith("  ")) {
        if (!STUB_LINE.test(line)) entry.lines.push(line.slice(2));
      } else flushEntry();
    }
  }

  flushEntry();
  return { pkgName, versions };
}

/** Reads and parses every `packages/<name>/CHANGELOG.md`. */
export function readPackageChangelogs(repoRoot = REPO_ROOT) {
  const packagesDir = join(repoRoot, "packages");
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ dir: d.name, file: join(packagesDir, d.name, "CHANGELOG.md") }))
    .filter(({ file }) => {
      try {
        readFileSync(file);
        return true;
      } catch {
        return false;
      }
    })
    .map(({ dir, file }) =>
      parsePackageChangelog(readFileSync(file, "utf8"), `@templatical/${dir}`),
    )
    .sort((a, b) => a.pkgName.localeCompare(b.pkgName));
}

// ---------------------------------------------------------------------------
// Version ordering
// ---------------------------------------------------------------------------

/** Descending semver comparator. Prereleases sort below their release. */
export function compareVersionsDesc(a, b) {
  const parse = (v) => {
    const [core, pre = ""] = String(v).split("-", 2);
    const nums = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
    return { nums, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pb.nums[i] ?? 0) - (pa.nums[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return -1;
  if (!pb.pre) return 1;
  return pb.pre.localeCompare(pa.pre);
}

// ---------------------------------------------------------------------------
// Release dates
// ---------------------------------------------------------------------------

/**
 * Maps version -> ISO date from the per-package git tags (`@templatical/x@0.20.0`).
 * Returns an empty map when tags aren't present (a shallow CI clone), which is
 * why {@link resolveDates} keeps the committed JSON as the durable store.
 */
export function readTagDates(repoRoot = REPO_ROOT) {
  const dates = new Map();
  let out = "";
  try {
    out = execFileSync("git", ["tag", "--format=%(refname:strip=2)|%(creatordate:short)"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return dates;
  }
  for (const line of out.split("\n")) {
    const [ref, date] = line.split("|");
    if (!ref || !date) continue;
    const at = ref.lastIndexOf("@");
    if (at <= 0) continue;
    const version = ref.slice(at + 1);
    // Tags for one version share a date; first one wins.
    if (!dates.has(version)) dates.set(version, date);
  }
  return dates;
}

/** Reads the dates already recorded in a previously committed changelog.json. */
export function readRecordedDates(jsonPath = JSON_OUT) {
  const dates = new Map();
  try {
    const prev = JSON.parse(readFileSync(jsonPath, "utf8"));
    for (const v of prev.versions ?? []) {
      if (v.version && v.date) dates.set(v.version, v.date);
    }
  } catch {
    // No previous output (first run) — nothing to carry forward.
  }
  return dates;
}

/**
 * Resolves a release date per version.
 *
 * Tag dates win so a date recorded from `today` gets corrected to the real
 * release date on a later run; recorded dates come next so a shallow clone
 * without tags stays stable.
 *
 * `today` applies to the newest version only — its tag is pushed after this runs,
 * so it is the one release that legitimately has no date yet. `versions` must be
 * in descending order for that to hold. An older version with neither a tag nor a
 * recorded date predates tagging and gets no date rather than a fabricated one.
 */
export function resolveDates(versions, { tagDates, recordedDates, today }) {
  const resolved = new Map();
  versions.forEach((version, index) => {
    const fallback = index === 0 ? today : undefined;
    const date = tagDates.get(version) ?? recordedDates.get(version) ?? fallback;
    if (date) resolved.set(version, date);
  });
  return resolved;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Merges the parsed per-package changelogs into one timeline.
 *
 * Entries dedupe by commit hash. When a changeset bumps packages at different
 * levels the highest wins, so a release that is breaking for one package is not
 * filed under "Fixes".
 */
export function aggregate(parsedPackages) {
  /** @type {Map<string, Map<string, {hash: string, level: string, raw: string, packages: Set<string>}>>} */
  const byVersion = new Map();

  for (const { pkgName, versions } of parsedPackages) {
    for (const { version, entries } of versions) {
      if (!byVersion.has(version)) byVersion.set(version, new Map());
      const bucket = byVersion.get(version);

      for (const entry of entries) {
        const raw = entry.lines.join("\n").replace(/\s+$/, "");
        const existing = bucket.get(entry.hash);
        if (!existing) {
          bucket.set(entry.hash, {
            hash: entry.hash,
            level: entry.level,
            raw,
            packages: new Set([pkgName]),
          });
          continue;
        }
        existing.packages.add(pkgName);
        if (LEVEL_RANK[entry.level] > LEVEL_RANK[existing.level]) existing.level = entry.level;
        // Identical in practice; keep the fullest text if a package ever trims it.
        if (raw.length > existing.raw.length) existing.raw = raw;
      }
    }
  }

  return [...byVersion.keys()].sort(compareVersionsDesc).map((version) => {
    const changes = [...byVersion.get(version).values()].map((entry) => {
      const [title, ...rest] = entry.raw.split("\n");
      return {
        hash: entry.hash,
        level: entry.level,
        title: title.trim(),
        body: rest.join("\n").replace(/^\n+/, "").replace(/\s+$/, ""),
        packages: [...entry.packages].sort(),
      };
    });
    // Highest-impact first, then stable by hash so output never reorders on rerun.
    changes.sort(
      (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.hash.localeCompare(b.hash),
    );
    return { version, changes };
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Pushes headings inside an entry body below the page's own structure.
 *
 * The page uses `#` for the title, `##` per version and `###` per section, and
 * entry bodies carry their own `##` headings — left alone they would read as
 * version headers and shred the outline. Fenced code is passed through
 * untouched.
 */
export function demoteHeadings(markdown, minLevel = 4) {
  let inFence = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const match = /^(#{1,6}) (.*)$/.exec(line);
      if (!match) return line;
      const depth = Math.min(6, Math.max(minLevel, match[1].length + minLevel - 2));
      return `${"#".repeat(depth)} ${match[2]}`;
    })
    .join("\n");
}

/**
 * Fails loudly on content that would terminate the page's `v-pre` container.
 *
 * The whole version list is wrapped in `::: v-pre` so merge-tag syntax in entry
 * prose (`{{ tag }}`) isn't compiled as a Vue interpolation — Vue interpolates
 * inside `<code>` too, so escaping alone doesn't help. A line-initial `:::` would
 * close that wrapper early and produce a page that fails to build with a stack
 * trace pointing at compiled output instead of at the changeset that caused it.
 */
function assertContainerSafe(change) {
  const offending = change.body.split("\n").find((line) => line.startsWith(":::"));
  if (offending) {
    throw new Error(
      `Changeset ${change.hash} has a line starting with ':::' which would break the ` +
        `page's v-pre container:\n  ${offending}\n` +
        `Indent it inside a code fence in the source CHANGELOG.md entry.`,
    );
  }
}

/** Renders one entry: bold summary, package attribution, then the body. */
function renderChange(change) {
  assertContainerSafe(change);
  const packages = change.packages.map((p) => `\`${p}\``).join(" · ");
  const out = [`**${change.title}**`, "", packages];
  if (change.body) out.push("", demoteHeadings(change.body));
  return out.join("\n");
}

/** Renders the `### <section>` blocks for one version. */
export function renderVersionBody(version) {
  const out = [];
  for (const [level, label] of LEVEL_SECTIONS) {
    const changes = version.changes.filter((c) => c.level === level);
    if (changes.length === 0) continue;
    out.push(`### ${label}`, "");
    for (const change of changes) out.push(renderChange(change), "");
  }
  if (out.length === 0) out.push("_No user-facing changes — released to keep the suite in step._", "");
  return out.join("\n").replace(/\s+$/, "");
}

/** Renders the full docs page. */
export function renderMarkdown(versions, dates) {
  const out = [
    "---",
    "title: Changelog",
    "editLink: false",
    "outline: [2, 2]",
    "---",
    "",
    "<!-- Generated by apps/docs/scripts/build-changelog.mjs — do not edit by hand. -->",
    "",
    "# Changelog",
    "",
    "Every `@templatical/*` package shares one version number, so this is the whole",
    "suite's release history in one place. Each entry lists the packages it changed.",
    "",
    "Installing or upgrading is covered in [Installation](/getting-started/installation).",
    "",
    // Entry prose quotes merge-tag syntax (`{{ tag }}`), which Vue would compile as
    // an interpolation — including inside inline code, so escaping alone won't do.
    // `v-pre` opts the whole list out of Vue compilation; links and code blocks are
    // static HTML by this point and keep working.
    "::: v-pre",
    "",
  ];

  for (const version of versions) {
    const date = dates.get(version.version);
    out.push(`## ${version.version}`, "");
    if (date) out.push(`<time datetime="${date}">${date}</time>`, "");
    out.push(renderVersionBody(version), "");
  }

  out.push(":::");

  return `${out.join("\n").replace(/\s+$/, "")}\n`;
}

/**
 * Renders one version's notes for a GitHub release body.
 *
 * The footer states that every package publishes at this version rather than
 * listing only the ones that carried prose — they are one `fixed` group, so a
 * partial list would read as "the others didn't ship".
 */
export function renderReleaseNotes(versions, version, allPackages = []) {
  const match = versions.find((v) => v.version === version);
  if (!match) throw new Error(`No changelog entries found for version ${version}`);
  const footer = [
    "---",
    "",
    `All ${allPackages.length || 10} \`@templatical/*\` packages are published at \`${version}\` — they share one version number.`,
    "",
    "Full changelog: https://docs.templatical.com/changelog",
  ].join("\n");
  return `${renderVersionBody(match)}\n\n${footer}\n`;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** Builds both outputs in memory. Used by the freshness test. */
export function buildOutputs({ repoRoot = REPO_ROOT, today } = {}) {
  const parsed = readPackageChangelogs(repoRoot);
  const versions = aggregate(parsed);
  const dates = resolveDates(
    versions.map((v) => v.version),
    {
      tagDates: readTagDates(repoRoot),
      recordedDates: readRecordedDates(join(repoRoot, "apps", "docs", "public", "changelog.json")),
      today,
    },
  );

  const withDates = versions.map((v) => ({
    version: v.version,
    date: dates.get(v.version) ?? null,
    changes: v.changes,
  }));

  return {
    versions: withDates,
    packages: parsed.map((p) => p.pkgName),
    markdown: renderMarkdown(versions, dates),
    json: `${JSON.stringify(
      {
        $comment: "Generated by apps/docs/scripts/build-changelog.mjs — do not edit by hand.",
        packages: parsed.map((p) => p.pkgName),
        latest: withDates[0]?.version ?? null,
        versions: withDates,
      },
      null,
      2,
    )}\n`,
  };
}

function main(argv) {
  const releaseNotesIndex = argv.indexOf("--release-notes");
  if (releaseNotesIndex !== -1) {
    const version = argv[releaseNotesIndex + 1];
    if (!version) {
      process.stderr.write("--release-notes requires a version argument\n");
      process.exitCode = 1;
      return;
    }
    // A clean message rather than a stack trace: the caller is a release step whose
    // log a human reads when it falls back to a minimal release body.
    try {
      const { versions, packages } = buildOutputs();
      process.stdout.write(renderReleaseNotes(versions, version, packages));
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { markdown, json } = buildOutputs({ today });

  if (argv.includes("--check")) {
    const stale = [];
    for (const [path, expected] of [
      [MARKDOWN_OUT, markdown],
      [JSON_OUT, json],
    ]) {
      let actual = null;
      try {
        actual = readFileSync(path, "utf8");
      } catch {
        // Missing counts as stale.
      }
      if (actual !== expected) stale.push(path);
    }
    if (stale.length) {
      process.stderr.write(
        `Changelog outputs are stale:\n${stale.map((p) => `  ${p}`).join("\n")}\n` +
          `Run: node apps/docs/scripts/build-changelog.mjs\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write("Changelog outputs are up to date.\n");
    return;
  }

  mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(MARKDOWN_OUT, markdown);
  writeFileSync(JSON_OUT, json);
  const count = JSON.parse(json).versions.length;
  process.stdout.write(
    `Wrote ${MARKDOWN_OUT} and ${JSON_OUT} (${count} versions).\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
