import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../.vitepress/config";

/**
 * Every extra VitePress locale (today: `de`) mirrors English: same markdown
 * paths, same heading-level outline, same internal nav/sidebar targets.
 * Prose is not compared.
 *
 * Adding a language is two steps — `locales.<code>` in `.vitepress/config.ts`
 * and `apps/docs/<code>/` with the mirrored tree. This file discovers locales
 * from the config; it does not name them.
 *
 * `changelog.md` exists in every tree; non-English copies are stubs that link
 * through to English, so their outline is not asserted.
 */

const DOCS = join(import.meta.dirname, "..");

const SKIP_DIRS = new Set([
  "public",
  "node_modules",
  ".vitepress",
  "tests",
  "scripts",
]);

function localeCodes(): string[] {
  return Object.keys(config.locales ?? {}).filter((key) => key !== "root");
}

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

function englishPaths(all: string[], locales: string[]): string[] {
  return all.filter((rel) => !locales.some((l) => rel === l || rel.startsWith(`${l}/`)));
}

function localePaths(all: string[], locale: string): string[] {
  const prefix = `${locale}/`;
  return all
    .filter((rel) => rel.startsWith(prefix))
    .map((rel) => rel.slice(prefix.length));
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

function stripLocalePrefix(link: string, locale: string): string | null {
  if (/^https?:\/\//.test(link)) return null;
  if (!link.startsWith("/")) return null;
  const prefix = `/${locale}`;
  let path = link;
  if (path === prefix) path = "/";
  else if (path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
  if (path.length > 1) path = path.replace(/\/$/, "");
  return path;
}

function internalEnglishPath(link: string, locales: string[]): string | null {
  if (/^https?:\/\//.test(link)) return null;
  if (!link.startsWith("/")) return null;
  for (const locale of locales) {
    const stripped = stripLocalePrefix(link, locale);
    if (stripped !== null && link.startsWith(`/${locale}`)) return stripped;
  }
  return link.length > 1 ? link.replace(/\/$/, "") : link;
}

describe("docs locales stay in lockstep with English", () => {
  const locales = localeCodes();
  const all = walkMarkdown(DOCS);
  const en = englishPaths(all, locales).sort();

  it("registers each extra locale as a VitePress locale with a matching directory", () => {
    expect(locales.length).toBeGreaterThan(0);
    for (const locale of locales) {
      expect(existsSync(join(DOCS, locale)), locale).toBe(true);
    }
  });

  it.each(locales)(
    "%s has a markdown file for every English page, and none extra",
    (locale) => {
      expect(en.length).toBeGreaterThan(20);
      expect(localePaths(all, locale).sort()).toEqual(en);
    },
  );

  it.each(locales)(
    "%s keeps the same heading-level outline on each pair except changelog",
    (locale) => {
      const mismatches: string[] = [];
      for (const rel of en) {
        if (rel === "changelog.md") continue;
        const enSrc = readFileSync(join(DOCS, rel), "utf8");
        const locSrc = readFileSync(join(DOCS, locale, rel), "utf8");
        const a = headingOutline(enSrc);
        const b = headingOutline(locSrc);
        if (a.join(",") !== b.join(",")) {
          mismatches.push(`${rel}: en [${a}] ${locale} [${b}]`);
        }
      }
      expect(mismatches).toEqual([]);
    },
  );

  it.each(locales)(
    "%s exposes the same internal nav and sidebar paths as English",
    (locale) => {
      const enLinks = collectFromTheme(config.locales?.root?.themeConfig ?? {});
      const locLinks = collectFromTheme(
        config.locales?.[locale]?.themeConfig ?? {},
      );
      const enPaths = [
        ...new Set(
          enLinks
            .map((l) => internalEnglishPath(l, locales))
            .filter((p): p is string => p !== null),
        ),
      ].sort();
      const locPaths = [
        ...new Set(
          locLinks
            .map((l) => stripLocalePrefix(l, locale))
            .filter((p): p is string => p !== null),
        ),
      ].sort();
      expect(locPaths).toEqual(enPaths);
    },
  );
});
