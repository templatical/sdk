import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "../../..");
const DOCS = join(REPO, "apps/docs");
const SKILL = join(REPO, "skills/templatical");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const SKIP_DIRS = new Set(["public", "node_modules", ".vitepress", "tests", "scripts"]);
const SKIP_FILES = new Set(["changelog.md", "de/changelog.md"]);

function docsPages(dir = DOCS, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(DOCS, abs).split(sep).join("/");
    if (statSync(abs).isDirectory()) {
      if (!SKIP_DIRS.has(name)) docsPages(abs, acc);
    } else if (rel.endsWith(".md") && !SKIP_FILES.has(rel)) {
      acc.push(`apps/docs/${rel}`);
    }
  }
  return acc;
}

function skillPages(dir = SKILL, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (name !== "node_modules") skillPages(abs, acc);
    } else if (name.endsWith(".md")) {
      acc.push(relative(REPO, abs).split(sep).join("/"));
    }
  }
  return acc;
}

/**
 * The editor, core and media library are FSL-1.1-MIT: source-available, not
 * open source, and "OSS" names the free tier whose editor is that FSL code.
 * Copy therefore avoids "open source", "quelloffen" and "OSS" in every
 * grammatical position ("Templatical is open source", "the OSS SDK", "ein
 * Open-Source-Projekt"). The one allowance is a mention that sits next to a
 * subject that really is open source: the MIT renderer, the Agent Skill, MJML,
 * Easy Email or GrapesJS. Each mention is judged on its own, by the 60
 * characters on either side of it. Docs put a whole paragraph on one line, so
 * a subject named elsewhere in the paragraph does not excuse it ("The OSS
 * palette ... The OSS renderer ..."). The two licence FAQ pages discuss
 * licensing explicitly and are pinned by the cases below instead.
 */
const SUBJECT_REACH = 60;
// Global so matchAll yields every mention. A global regex keeps lastIndex
// between .test calls, so this one is only ever read through matchAll.
const LICENCE_WORDING = /open[- ]?source|quelloffen|\bOSS\b/gi;
const OPEN_SOURCE_SUBJECT =
  /renderer|Agent Skill|Agent-Skill|markup language|Markup-Sprache|Easy[- ]Email|GrapesJS/i;
const isLicenceClaim = (line: string) =>
  [...line.matchAll(LICENCE_WORDING)].some(
    (mention) =>
      !OPEN_SOURCE_SUBJECT.test(
        line.slice(
          Math.max(0, mention.index - SUBJECT_REACH),
          mention.index + mention[0].length + SUBJECT_REACH,
        ),
      ),
  );

const LICENCE_PAGES = new Set(["apps/docs/license-faq.md", "apps/docs/de/license-faq.md"]);

const COPY = [
  ...docsPages(),
  "README.md",
  "CONTRIBUTING.md",
  ...readdirSync(join(REPO, "packages"))
    .map((dir) => `packages/${dir}/README.md`)
    .filter((path) => existsSync(join(REPO, path))),
  ...skillPages(),
  "apps/playground/src/i18n/en.ts",
  "apps/playground/src/i18n/de.ts",
];

describe("licence wording in user-facing copy", () => {
  it("scans the docs, READMEs, contributing guide, skill and playground strings", () => {
    expect(COPY.length).toBeGreaterThan(100);
    expect(COPY).toContain("CONTRIBUTING.md");
    expect(COPY).toContain("skills/templatical/SKILL.md");
    expect(COPY).toContain("skills/templatical/reference/failure-modes.md");
    expect(COPY.filter((path) => path.includes("node_modules"))).toEqual([]);
  });

  it("never calls FSL code open source", () => {
    const hits = COPY.filter((path) => !LICENCE_PAGES.has(path)).flatMap((path) =>
      read(path)
        .split("\n")
        .flatMap((line, i) =>
          isLicenceClaim(line) ? [`${path}:${i + 1}: ${line.trim().slice(0, 120)}`] : [],
        ),
    );
    expect(hits).toEqual([]);
  });
});

describe("the licence-claim predicate", () => {
  it.each([
    "Templatical is open source.",
    "The editor is open-source, so it is free.",
    "Templatical is an open-source email builder.",
    "an open-source project",
    "open-source editors",
    "Free & open source",
    "Templatical ist Open Source.",
    "ein Open-Source-Projekt",
    "Der Editor ist quelloffen.",
    "the OSS SDK",
  ])("flags %j", (line) => {
    expect(isLicenceClaim(line)).toBe(true);
  });

  it.each([
    "The OSS renderer emits a placeholder.",
    "One free, open-source Agent Skill",
    "MJML is an open-source markup language",
    "Open-source Easy Email is a different JSON",
    "der OSS-Renderer kann es nicht erzeugen",
  ])("passes %j", (line) => {
    expect(isLicenceClaim(line)).toBe(false);
  });

  it("flags a claim that sits far from the allowed subject on the same line", () => {
    // One paragraph on one line, as the docs write them: the last sentence, which
    // carries "renderer", starts more than 60 characters after the OSS claim in
    // the first. The line names an allowed subject, but not next to that claim.
    const line =
      "The OSS palette never offers countdown. Listing it in paletteBlocks logs an " +
      "unknown-block warning; it does not enable the block. " +
      "The OSS renderer emits a placeholder.";
    expect(OPEN_SOURCE_SUBJECT.test(line)).toBe(true);
    expect(isLicenceClaim(line)).toBe(true);
  });
});

describe("the licence FAQ", () => {
  const published = readdirSync(join(REPO, "packages"))
    .map((dir) => join(REPO, "packages", dir, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, "utf8")))
    .filter((pkg) => !pkg.private)
    .map((pkg) => ({ name: pkg.name as string, license: pkg.license as string }));

  it.each(["apps/docs/license-faq.md", "apps/docs/de/license-faq.md"])(
    "%s lists every published package with its licence",
    (page) => {
      const rows = new Map(
        [...read(page).matchAll(/^\| `(@templatical\/[a-z-]+)` \| \[([A-Z0-9.-]+)\]/gm)].map(
          ([, name, license]) => [name, license],
        ),
      );
      expect(published.length).toBeGreaterThan(10);
      for (const { name, license } of published) expect(rows.get(name), name).toBe(license);
      expect(rows.size).toBe(published.length);
    },
  );

  it.each([
    ["apps/docs/license-faq.md", "## Is Templatical open source?"],
    ["apps/docs/de/license-faq.md", "## Ist Templatical Open Source?"],
  ])("%s answers the open-source question", (page, heading) => {
    expect(read(page)).toContain(heading);
  });
});
