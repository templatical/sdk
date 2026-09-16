import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../.vitepress/config";

/**
 * English pages have a German mirror with the same path, the same heading
 * outline, and the same internal nav/sidebar targets. Prose is not compared.
 *
 * `changelog.md` exists in both trees; the German file is a stub that links
 * through to English, so its outline is not asserted.
 */

const DOCS = join(import.meta.dirname, "..");

const SKIP_DIRS = new Set([
  "public",
  "node_modules",
  ".vitepress",
  "tests",
  "scripts",
]);

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(DOCS, abs).split(sep).join("/");
    if (statSync(abs).isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walkMarkdown(abs, acc);
      continue;
    }
    if (rel.endsWith(".md")) acc.push(rel);
  }
  return acc;
}

function englishPaths(all: string[]): string[] {
  return all.filter((rel) => !rel.startsWith("de/"));
}

function germanPaths(all: string[]): string[] {
  return all
    .filter((rel) => rel.startsWith("de/"))
    .map((rel) => rel.slice("de/".length));
}

function headingOutline(src: string): number[] {
  const levels: number[] = [];
  for (const line of src.split("\n")) {
    const m = /^(#{1,6}) /.exec(line);
    if (m) levels.push(m[1].length);
  }
  return levels;
}

function collectLinks(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectLinks(item, acc);
    return acc;
  }
  if (node && typeof node === "object") {
    const rec = node as { link?: unknown; items?: unknown };
    if (typeof rec.link === "string") acc.push(rec.link);
    if (rec.items) collectLinks(rec.items, acc);
  }
  return acc;
}

function collectFromTheme(theme: {
  nav?: unknown;
  sidebar?: unknown;
}): string[] {
  const acc: string[] = [];
  collectLinks(theme.nav, acc);
  if (theme.sidebar && typeof theme.sidebar === "object") {
    collectLinks(Object.values(theme.sidebar), acc);
  }
  return acc;
}

function internalPath(link: string): string | null {
  if (/^https?:\/\//.test(link)) return null;
  let path = link;
  if (path === "/de" || path.startsWith("/de/")) {
    path = path.slice(3) || "/";
  }
  if (!path.startsWith("/")) return null;
  if (path.length > 1) path = path.replace(/\/$/, "");
  return path;
}

describe("English and German docs stay in lockstep", () => {
  const all = walkMarkdown(DOCS);
  const en = englishPaths(all).sort();
  const de = germanPaths(all).sort();

  it("has a German markdown file for every English page, and none extra", () => {
    expect(en.length).toBeGreaterThan(20);
    expect(de).toEqual(en);
  });

  it("keeps the same heading-level outline on each pair except changelog", () => {
    const mismatches: string[] = [];
    for (const rel of en) {
      if (rel === "changelog.md") continue;
      const enSrc = readFileSync(join(DOCS, rel), "utf8");
      const deSrc = readFileSync(join(DOCS, "de", rel), "utf8");
      const a = headingOutline(enSrc);
      const b = headingOutline(deSrc);
      if (a.join(",") !== b.join(",")) {
        mismatches.push(`${rel}: en [${a}] de [${b}]`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("exposes the same internal nav and sidebar paths in both locales", () => {
    const enLinks = collectFromTheme(config.locales?.root?.themeConfig ?? {});
    const deLinks = collectFromTheme(config.locales?.de?.themeConfig ?? {});
    const enPaths = new Set(
      enLinks.map(internalPath).filter((p): p is string => p !== null),
    );
    const dePaths = new Set(
      deLinks.map(internalPath).filter((p): p is string => p !== null),
    );
    expect([...enPaths].sort()).toEqual([...dePaths].sort());
  });
});
