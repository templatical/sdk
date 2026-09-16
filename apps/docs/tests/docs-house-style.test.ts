import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../.vitepress/config";

/**
 * OSS docs house style: voice, package-manager install snippets, renderer
 * wording, Cloud-vs-OSS attribution, preview URL, countdown.
 *
 * Skip: changelog (history), cloud/ (WIP), public/ (generated).
 */

const DOCS = join(import.meta.dirname, "..");
const REPO = join(DOCS, "../..");

const SKIP_DIRS = new Set([
  "cloud",
  "de/cloud",
  "public",
  "node_modules",
  ".vitepress",
  "tests",
  "scripts",
]);

const SKIP_FILES = new Set(["changelog.md", "de/changelog.md"]);

const ADVERBS = /\b(deliberately|genuinely|precisely|merely)\b/i;
const DERIVED_BLOCK_COUNT = /\ball\s+\d+\s+built-in block/i;
const RENDERER_AS_HTML = /JSON\s*→\s*MJML\s*→\s*HTML/;
const BANNED_HEADINGS = [
  "## What's actually happening here",
  "## Trying it out",
  "## Why MJML?",
  "## What the renderer does NOT do",
];

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(DOCS, abs).split(sep).join("/");
    if (statSync(abs).isDirectory()) {
      const top = rel.split("/")[0];
      if (SKIP_DIRS.has(top) || SKIP_DIRS.has(rel)) continue;
      walkMarkdown(abs, acc);
      continue;
    }
    if (!rel.endsWith(".md")) continue;
    if (SKIP_FILES.has(rel)) continue;
    acc.push(rel);
  }
  return acc;
}

function readDocs(rel: string): string {
  return readFileSync(join(DOCS, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

/** ` ```bash ` fences whose body is a single `npm install …` line and whose
 *  info string is not `bash [npm]` (i.e. not inside the four-manager group). */
function bareNpmInstallFences(src: string): string[] {
  const hits: string[] = [];
  const re = /```bash(?<info>[^\n]*)\n(?<body>[\s\S]*?)```/g;
  for (const m of src.matchAll(re)) {
    const info = (m.groups?.info ?? "").trim();
    const body = (m.groups?.body ?? "").trim();
    if (!/^npm install /.test(body)) continue;
    if (body.includes("\n")) continue;
    if (info.startsWith("[npm]")) continue;
    hits.push(body);
  }
  return hits;
}

describe("OSS docs house style", () => {
  const pages = walkMarkdown(DOCS);

  it("walks a non-empty OSS markdown set", () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(pages.some((p) => p.startsWith("cloud/"))).toBe(false);
    expect(pages).not.toContain("changelog.md");
  });

  it("has no editorial adverbs outside changelog and Cloud", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      const src = readDocs(rel);
      for (const [i, line] of src.split("\n").entries()) {
        if (ADVERBS.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not encode a derived built-in block count", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      if (DERIVED_BLOCK_COUNT.test(readDocs(rel))) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it("does not use the banned claim headings", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      const src = readDocs(rel);
      for (const heading of BANNED_HEADINGS) {
        if (src.split("\n").includes(heading)) hits.push(`${rel}: ${heading}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not document npm-only install fences", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      for (const body of bareNpmInstallFences(readDocs(rel))) {
        hits.push(`${rel}: ${body}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not describe the renderer as JSON → MJML → HTML", () => {
    const files = [
      "README.md",
      "apps/docs/showcase.md",
      "apps/docs/guide/agent-skill.md",
    ];
    const hits: string[] = [];
    for (const rel of files) {
      const src = rel.startsWith("apps/") ? readDocs(rel.slice("apps/docs/".length)) : readRepo(rel);
      if (RENDERER_AS_HTML.test(src)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it("does not list comments or saved blocks as Cloud additions in the license FAQ", () => {
    const src = readDocs("license-faq.md");
    expect(src).not.toMatch(
      /adds AI rewrite, real-time collaboration, comments/i,
    );
    expect(src).toMatch(/Cloud is one adapter, not the feature/);
  });

  it("keeps the editor screenshot as a single marketing URL with no-referrer", () => {
    const hero = readFileSync(
      join(DOCS, ".vitepress/theme/HeroPreview.vue"),
      "utf8",
    );
    expect(hero).toContain('SRC = "https://templatical.com/preview.png"');
    expect(hero).toContain('referrerpolicy="no-referrer"');
    expect(readRepo("README.md")).toContain(
      "https://templatical.com/preview.png",
    );
    expect(readDocs("index.md")).not.toContain("preview.png");
    expect(readDocs("de/index.md")).not.toContain("preview.png");
  });

  it("tells the agent skill never to emit countdown or custom", () => {
    const src = readDocs("guide/agent-skill.md");
    expect(src).toMatch(/Never emit `countdown`/);
    expect(src).toMatch(/Never emit `custom`/);
    expect(readDocs("guide/migration-from-unlayer.md")).not.toMatch(
      /Recreate using Templatical's `CountdownBlock`/,
    );
  });

  it("does not put Cloud comments in the README docs list", () => {
    expect(readRepo("README.md")).not.toMatch(
      /Cloud \(AI, Collab, Comments\)/,
    );
  });

  it("sends Guide and Get Started to Quick Start", () => {
    const src = readFileSync(join(DOCS, ".vitepress/config.ts"), "utf8");
    expect(src).toMatch(
      /\{ text: "Guide", link: "\/getting-started\/quick-start" \}/,
    );
    expect(readDocs("index.md")).toMatch(
      /link: \/getting-started\/quick-start/,
    );
  });

  it("does not link OSS pages into /cloud/", () => {
    const hits: string[] = [];
    const banned = /\]\(\/(?:de\/)?cloud\/|docs\.templatical\.com\/(?:de\/)?cloud/;
    for (const rel of pages) {
      for (const [i, line] of readDocs(rel).split("\n").entries()) {
        if (banned.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
    for (const rel of [
      "README.md",
      "packages/editor/README.md",
      "packages/core/README.md",
      "packages/media-library/README.md",
    ]) {
      for (const [i, line] of readRepo(rel).split("\n").entries()) {
        if (banned.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps Cloud out of nav, sidebar, robots, and the sitemap", () => {
    const robots = readDocs("public/robots.txt");
    expect(robots).toMatch(/^Disallow: \/cloud\/$/m);
    expect(robots).toMatch(/^Disallow: \/de\/cloud\/$/m);

    const transform = config.sitemap?.transformItems;
    expect(typeof transform).toBe("function");
    expect(
      transform!([
        { url: "https://docs.templatical.com/guide/theming" },
        { url: "https://docs.templatical.com/cloud/ai" },
        { url: "https://docs.templatical.com/de/cloud/" },
      ]),
    ).toEqual([{ url: "https://docs.templatical.com/guide/theming" }]);

    const src = readFileSync(join(DOCS, ".vitepress/config.ts"), "utf8");
    expect(src).not.toMatch(/link:\s*"\/(?:de\/)?cloud/);
  });

  it("does not put token-count or pluggable-syntax jargon on the home cards", () => {
    expect(readDocs("index.md")).not.toMatch(/27 OKLch/i);
    expect(readDocs("de/index.md")).not.toMatch(/27 OKLch/i);
    expect(readDocs("index.md")).not.toMatch(/pluggable syntax/i);
    expect(readDocs("de/index.md")).not.toMatch(/pluggable Syntax/i);
  });

  it("Quick Start mounts from the CDN, not a bare package import", () => {
    for (const rel of [
      "getting-started/quick-start.md",
      "de/getting-started/quick-start.md",
    ]) {
      const src = readDocs(rel);
      expect(src, rel).not.toMatch(/from ['"]@templatical\/editor['"]/);
      expect(src, rel).toMatch(
        /unpkg\.com\/@templatical\/editor\/dist\/cdn\/editor\.js/,
      );
    }
  });
});
