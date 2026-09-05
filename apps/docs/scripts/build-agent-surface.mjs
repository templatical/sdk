// apps/docs/scripts/build-agent-surface.mjs
//
// Generates the machine-readable index of these docs — llms.txt (the index an
// agent fetches first), llms-full.txt (the whole English corpus in one file for
// agents that prefer a single fetch), and public/llms-meta.json (which SDK
// version the docs describe, so a reader can tell whether they are ahead of
// their own install).
//
// All three are generated output and must never be hand-edited;
// tests/build-agent-surface.test.ts asserts the committed files equal a fresh
// generation, the same guard build-changelog.mjs carries.
//
// English only. The de/ mirror is deliberately absent from the index: agents
// work in English for an API surface, and a mirrored index would double its
// size for no gain. Per-page raw markdown (served by the buildEnd hook in
// .vitepress/config.ts) covers every locale, because that is a file copy.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(HERE, "..");
const REPO_ROOT = join(DOCS_DIR, "..", "..");

export const SITE_URL = "https://docs.templatical.com";

const PUBLIC_DIR = join(DOCS_DIR, "public");
const INDEX_OUT = join(PUBLIC_DIR, "llms.txt");
const FULL_OUT = join(PUBLIC_DIR, "llms-full.txt");
const META_OUT = join(PUBLIC_DIR, "llms-meta.json");

const SITE_TITLE = "Templatical";
const SITE_SUMMARY =
  "Drag-and-drop email editor for modern apps — source-available, MIT after two years.";

// Generator output, and 27% of the corpus. public/changelog.json serves it.
const EXCLUDED = new Set(["changelog.md"]);

// `public` is skipped both because it holds no pages and because it is where
// this generator writes — walking it would feed the output back into the input.
const SKIP_DIRS = new Set(["de", "node_modules", ".vitepress", "public", "tests", "scripts"]);

// Only where title-casing the directory would read wrong. A directory with no
// entry here still gets a sensible name, so a new docs section needs no edit.
const GROUP_NAMES = {
  "getting-started": "Getting Started",
  api: "API Reference",
  backend: "Connect your backend",
};

// Reading order, not alphabetical: an agent scanning the index should meet
// installation before the API reference. Anything absent sorts after these.
const GROUP_ORDER = [
  "Overview",
  "Getting Started",
  "Guide",
  "API Reference",
  "Connect your backend",
  "Cloud",
  "Quality",
];

/** The display name for the group a page belongs to. */
export function groupOf(relPath) {
  const [head, ...rest] = relPath.split("/");
  if (rest.length === 0) return "Overview";
  return (
    GROUP_NAMES[head] ??
    head
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function walk(dir, base, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(abs, base, out);
      continue;
    }
    if (!entry.endsWith(".md")) continue;
    const rel = relative(base, abs).split(sep).join("/");
    if (EXCLUDED.has(rel)) continue;
    out.push(rel);
  }
  return out;
}

/** Split a page into its frontmatter fields and its body. */
function parsePage(source) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!match) return { fields: {}, body: source.trim() };
  const fields = {};
  for (const line of match[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return { fields, body: source.slice(match[0].length).trim() };
}

/** Derive a title from a path when no frontmatter title or H1 exists. */
function titleFromPath(relPath) {
  const basename = relPath.split("/").pop().replace(/\.md$/, "");
  if (basename === "index") return null; // Directory index; handled by the caller
  return basename
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** cleanUrls is on, so a page's url carries no extension. */
function urlFor(relPath) {
  if (relPath === "index.md") return `${SITE_URL}/`;
  if (relPath.endsWith("/index.md")) {
    return `${SITE_URL}/${relPath.slice(0, -"index.md".length)}`;
  }
  return `${SITE_URL}/${relPath.slice(0, -".md".length)}`;
}

/**
 * Every English page, with its frontmatter and body.
 *
 * Throws when a page has no description. That is the enforcement point: a page
 * added without one would otherwise be silently absent from the index, which is
 * how an index quietly stops covering the docs it claims to.
 */
export function collectPages(docsDir = DOCS_DIR) {
  return walk(docsDir, docsDir)
    .sort()
    .map((rel) => {
      const { fields, body } = parsePage(readFileSync(join(docsDir, rel), "utf8"));
      const description = fields.description ?? "";
      if (!description) {
        throw new Error(
          `${rel} has no frontmatter description. Every page needs one — it is the meta description and the line an agent reads in llms.txt.`,
        );
      }
      const heading = /^#\s+(.+)$/m.exec(body);
      // Title fallback chain: frontmatter > first H1 > derived from path.
      // The path-derived fallback exists for layout: home pages (like index.md)
      // that carry no title field and no body H1 — a filename alone in a
      // machine-readable index is a defect. Root index falls back to SITE_TITLE
      // to keep the home page's title semantic rather than filesystem-literal.
      let title = fields.title ?? heading?.[1];
      if (!title) {
        title = rel === "index.md" ? SITE_TITLE : titleFromPath(rel);
      }
      return {
        path: rel,
        url: urlFor(rel),
        group: groupOf(rel),
        title,
        description,
        body,
      };
    });
}

function orderedGroups(pages) {
  const seen = [...new Set(pages.map((p) => p.group))];
  const known = GROUP_ORDER.filter((g) => seen.includes(g));
  const rest = seen.filter((g) => !GROUP_ORDER.includes(g)).sort();
  return [...known, ...rest];
}

/** The index: site summary, then one link line per page, grouped. */
export function renderIndex(pages, meta) {
  const lines = [
    `# ${SITE_TITLE}`,
    "",
    `> ${SITE_SUMMARY}`,
    "",
    `Documentation for SDK version ${meta.version}. Every page below is also available as raw markdown at the same URL with \`.md\` appended.`,
    "",
  ];
  for (const group of orderedGroups(pages)) {
    lines.push(`## ${group}`, "");
    for (const page of pages.filter((p) => p.group === group)) {
      lines.push(`- [${page.title}](${page.url}): ${page.description}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Strip a body's own leading H1. `renderFull()` supplies the entry's heading
 * itself (from `page.title`, the same fallback chain the index uses) — the
 * body's leading H1 is redundant at best and, on a page whose frontmatter
 * title differs from its H1 (e.g. cloud/getting-started.md), a second,
 * different heading right after the first. Anchored to the very start of the
 * string, so only a genuinely leading H1 is removed; a heading further down
 * the body is real content and stays.
 */
function stripLeadingH1(body) {
  return body.replace(/^#\s+.+\n+/, "");
}

/** The whole English corpus, one page after another. */
export function renderFull(pages) {
  const parts = [`# ${SITE_TITLE}`, "", `> ${SITE_SUMMARY}`, ""];
  for (const page of pages) {
    parts.push(
      `---`,
      "",
      `# ${page.title}`,
      "",
      `Source: ${page.url}`,
      "",
      stripLeadingH1(page.body),
      "",
    );
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

export function buildOutputs({ docsDir = DOCS_DIR, repoRoot = REPO_ROOT } = {}) {
  const pages = collectPages(docsDir);
  const sdkVersion = JSON.parse(
    readFileSync(join(repoRoot, "packages", "editor", "package.json"), "utf8"),
  ).version;
  const meta = { sdkVersion, pageCount: pages.length, index: "/llms.txt", full: "/llms-full.txt" };
  return {
    pages,
    meta,
    index: renderIndex(pages, { version: sdkVersion }),
    full: renderFull(pages),
  };
}

function main(argv) {
  const { index, full, meta } = buildOutputs();
  if (argv.includes("--check")) {
    const stale = [
      [INDEX_OUT, index],
      [FULL_OUT, full],
      [META_OUT, `${JSON.stringify(meta, null, 2)}\n`],
    ].filter(([path, expected]) => readFileSync(path, "utf8") !== expected);
    if (stale.length > 0) {
      process.stderr.write(
        `Stale agent surface. Run: pnpm --filter @templatical/docs run build:agent-surface\n${stale
          .map(([path]) => `  ${relative(REPO_ROOT, path)}`)
          .join("\n")}\n`,
      );
      process.exitCode = 1;
    }
    return;
  }
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(INDEX_OUT, index);
  writeFileSync(FULL_OUT, full);
  writeFileSync(META_OUT, `${JSON.stringify(meta, null, 2)}\n`);
  process.stdout.write(
    `Wrote public/llms.txt, public/llms-full.txt and public/llms-meta.json (${meta.pageCount} pages, SDK ${meta.sdkVersion})\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2));
}

/**
 * Copy every source markdown file into the build output beside its rendered
 * page, so each page is fetchable at its own URL with `.md` appended.
 *
 * Called from VitePress's buildEnd hook. Covers every locale, including de/,
 * because it is a file copy — only the generated index is English-only. Not
 * routed through public/: that directory is copied to the output root, and
 * mirroring a route tree inside it invites collisions with real routes.
 */
export function copyMarkdownSources(outDir, docsDir = DOCS_DIR) {
  const copied = [];
  const walkAll = (dir) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) {
        if (!SKIP_DIRS.has(entry) || entry === "de") walkAll(abs);
        continue;
      }
      if (!entry.endsWith(".md")) continue;
      const rel = relative(docsDir, abs).split(sep).join("/");
      const dest = join(outDir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(abs, "utf8"));
      copied.push(rel);
    }
  };
  walkAll(docsDir);
  return copied;
}
