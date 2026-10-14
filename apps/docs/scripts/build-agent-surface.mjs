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
// size for no gain. Cloud is absent too: that tier is WIP and has no OSS
// clients, and listing it sends agents into pages that contradict the BYO
// contracts. Per-page raw markdown (served by the buildEnd hook in
// .vitepress/config.ts) still covers every locale and cloud/: it copies every
// page, inlining only `<<<` includes.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
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
const SKIP_DIRS = new Set([
  "de",
  "cloud",
  "node_modules",
  ".vitepress",
  "public",
  "tests",
  "scripts",
]);

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
  "Frameworks",
  "Guide",
  "API Reference",
  "Connect your backend",
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

/**
 * Derive a title from a path when no frontmatter title or H1 exists. A
 * directory index derives from its parent directory segment rather than its
 * own "index" basename, so `guide/widgets/index.md` yields "Widgets" instead
 * of a literal "index". Returns null only for the root `index.md`, which has
 * no parent segment to derive from — the caller falls back to SITE_TITLE for
 * that page.
 */
function titleFromPath(relPath) {
  const segments = relPath.replace(/\.md$/, "").split("/");
  const basename = segments.pop();
  const source = basename === "index" ? segments.pop() : basename;
  if (!source) return null;
  return source
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The url a page is served at. cleanUrls is on, so it carries no extension.
 * config.ts names each page's canonical and og:url with it, so those and the
 * page urls in llms.txt come from one function.
 */
export function urlFor(relPath) {
  if (relPath === "index.md") return `${SITE_URL}/`;
  if (relPath.endsWith("/index.md")) {
    return `${SITE_URL}/${relPath.slice(0, -"index.md".length)}`;
  }
  return `${SITE_URL}/${relPath.slice(0, -".md".length)}`;
}

// VitePress's `<<< path` include: a block line, indented at most three spaces.
const SNIPPET_RE = /^ {0,3}<<<[ \t]+(.+?)[ \t]*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Walk `source` line by line and replace every `<<<` include outside a fenced
 * code block with what `replace(rawPath)` returns.
 */
function mapSnippetIncludes(source, replace) {
  const out = [];
  let open = null;
  for (const line of source.split("\n")) {
    const fence = FENCE_RE.exec(line)?.[1] ?? null;
    if (open) {
      if (fence && fence[0] === open[0] && fence.length >= open.length && line.trim() === fence) {
        open = null;
      }
      out.push(line);
      continue;
    }
    if (fence) {
      open = fence;
      out.push(line);
      continue;
    }
    const include = SNIPPET_RE.exec(line);
    out.push(include ? replace(include[1]) : line);
  }
  return out.join("\n");
}

/** Every `<<<` include path in a markdown source, in order. */
export function snippetIncludes(source) {
  const found = [];
  mapSnippetIncludes(source, (rawPath) => {
    found.push(rawPath);
    return "";
  });
  return found;
}

/**
 * The file an include names, resolved as VitePress resolves it: `@` from the
 * docs root, anything else from the including page's directory. Only a bare
 * path is accepted. VitePress also reads a title, a region and line highlights
 * from that line, which the inlining below would drop, so those throw rather
 * than let the agent copy differ from the rendered page.
 */
export function resolveSnippetPath(rawPath, pagePath, docsDir = DOCS_DIR) {
  if (/\s\[|[{}]|#[\w.-]+$/.test(rawPath)) {
    throw new Error(
      `${relative(docsDir, pagePath)}: "<<< ${rawPath}" uses a snippet option (a title, a region or highlighted lines) that the agent surface does not reproduce. Include a bare path.`,
    );
  }
  if (rawPath.startsWith("@")) {
    return join(docsDir, rawPath.slice(/[\\/]/.test(rawPath[1] ?? "") ? 2 : 1));
  }
  return join(dirname(pagePath), rawPath);
}

/**
 * `source` with every `<<<` include replaced by a fenced block holding the
 * included file. llms-full.txt and each page's raw-markdown twin then carry the
 * code itself, not a VitePress directive an agent cannot follow.
 */
export function inlineSnippetIncludes(source, pagePath, docsDir = DOCS_DIR) {
  return mapSnippetIncludes(source, (rawPath) => {
    const file = resolveSnippetPath(rawPath, pagePath, docsDir);
    let code;
    try {
      code = readFileSync(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `${relative(docsDir, pagePath)}: "<<< ${rawPath}" names a file that does not exist (${file})`,
        );
      }
      throw error;
    }
    const longestRun = Math.max(0, ...[...code.matchAll(/`+/g)].map(([run]) => run.length));
    const fence = "`".repeat(Math.max(3, longestRun + 1));
    return [`${fence}${extname(file).slice(1)}`, code.replace(/\n$/, ""), fence].join("\n");
  });
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
    .flatMap((rel) => {
      const abs = join(docsDir, rel);
      const { fields, body } = parsePage(readFileSync(abs, "utf8"));
      // Stubs that exist so a human URL does not 404. Agents should fetch the
      // canonical page instead (see llms: false on guide/keyboard.md).
      if (fields.llms === "false") return [];
      const description = fields.description ?? "";
      if (!description) {
        throw new Error(
          `${rel} has no frontmatter description. Every page needs one — it is the meta description and the line an agent reads in llms.txt.`,
        );
      }
      const heading = /^#\s+(.+)$/m.exec(body);
      // Title fallback chain: frontmatter > first H1 > derived from path >
      // SITE_TITLE. The path-derived fallback exists for layout: pages (like
      // index.md, or a directory index) that carry no title field and no
      // body H1 — a filename alone in a machine-readable index is a defect.
      // titleFromPath returns null only for the root index.md, which has no
      // directory segment to derive from, so SITE_TITLE is the final
      // fallback there — keeping the home page's title semantic rather than
      // filesystem-literal.
      const title = fields.title ?? heading?.[1] ?? titleFromPath(rel) ?? SITE_TITLE;
      return [
        {
          path: rel,
          url: urlFor(rel),
          group: groupOf(rel),
          title,
          description,
          body: inlineSnippetIncludes(body, abs, docsDir),
        },
      ];
    });
}

/**
 * Group display order: the known groups in reading order, then anything new
 * alphabetically. Used by renderIndex below to lay out llms.txt; exported so
 * it can be tested and reused on its own.
 */
export function orderedGroups(pages) {
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
    // The `index.md` half is load-bearing: seven of these URLs end in `/`
    // (the home page and every directory index), and a bare `.md` on those
    // names a file that has never existed. Same directory-URL rule a web
    // server applies; stating only the simple half sends a reader to a 404.
    `Documentation for SDK version ${meta.version}. Every page below is also available as raw markdown: append \`.md\` to its URL, or \`index.md\` when the URL ends in \`/\`.`,
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
 * page, so each page is fetchable as raw markdown: append `.md` to its URL,
 * or `index.md` when the URL ends in `/`. The second half is a consequence of
 * each twin sitting at its source path — a directory index keeps its
 * `index.md` basename while cleanUrls serves the page itself at the bare
 * directory URL.
 *
 * Called from VitePress's buildEnd hook. Covers every locale, including de/,
 * and cloud/: it copies every page, inlining only `<<<` includes. Only the
 * generated index is English-only and Cloud-free. Not routed through public/:
 * that directory is copied to the output root, and mirroring a route tree
 * inside it invites collisions with real routes.
 */
export function copyMarkdownSources(outDir, docsDir = DOCS_DIR) {
  const copied = [];
  const walkAll = (dir) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) {
        if (!SKIP_DIRS.has(entry) || entry === "de" || entry === "cloud") {
          walkAll(abs);
        }
        continue;
      }
      if (!entry.endsWith(".md")) continue;
      const rel = relative(docsDir, abs).split(sep).join("/");
      const dest = join(outDir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, inlineSnippetIncludes(readFileSync(abs, "utf8"), abs, docsDir));
      copied.push(rel);
    }
  };
  walkAll(docsDir);
  return copied;
}
