import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The vendor's brand in prose is "Beefree". Public API identifiers keep
 * the historical spelling (`convertBeeFreeTemplate`, `BeeFreeTemplate`,
 * `BeeFreeeModule`, …). Changelog pages are history and stay as published.
 */

const DOCS = join(import.meta.dirname, "..");

const SKIP_DIRS = new Set([
  "public",
  "node_modules",
  ".vitepress",
  "tests",
  "scripts",
]);

const SKIP_FILES = new Set(["changelog.md", "de/changelog.md"]);

/** Brand token, not an identifier. `BeeFrees` is the German genitive. */
const BRAND = /(?<![A-Za-z0-9_])BeeFrees?(?![A-Za-z0-9_])/;

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(DOCS, abs).split(sep).join("/");
    if (statSync(abs).isDirectory()) {
      const top = rel.split("/")[0]!;
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

function brandHits(rel: string, src: string): string[] {
  const hits: string[] = [];
  for (const [i, line] of src.split("\n").entries()) {
    if (BRAND.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
  }
  return hits;
}

describe("Beefree spelling in the docs", () => {
  const pages = walkMarkdown(DOCS);

  it("covers English and German pages, including both migration guides", () => {
    expect(pages.filter((rel) => !rel.startsWith("de/")).length).toBeGreaterThan(20);
    expect(pages.filter((rel) => rel.startsWith("de/")).length).toBeGreaterThan(20);
    expect(pages).toContain("guide/migration-from-beefree.md");
    expect(pages).toContain("de/guide/migration-from-beefree.md");
    expect(pages).not.toContain("changelog.md");
    expect(pages).not.toContain("de/changelog.md");
  });

  it("keeps the converter's public identifiers in both migration guides", () => {
    for (const rel of [
      "guide/migration-from-beefree.md",
      "de/guide/migration-from-beefree.md",
    ]) {
      const src = readFileSync(join(DOCS, rel), "utf8");
      expect(src).toContain("convertBeeFreeTemplate");
      expect(src).toContain("ConvertBeeFreeOptions");
    }
  });

  it("does not spell the vendor BeeFree on any docs page outside the changelog", () => {
    const hits = pages.flatMap((rel) =>
      brandHits(rel, readFileSync(join(DOCS, rel), "utf8")),
    );
    expect(hits).toEqual([]);
  });

  it("does not spell the vendor BeeFree in nav or sidebar labels", () => {
    const rel = ".vitepress/config.ts";
    expect(brandHits(rel, readFileSync(join(DOCS, rel), "utf8"))).toEqual([]);
  });
});
