import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
// @ts-expect-error — plain .mjs generator, no types
import {
  buildOutputs,
  collectPages,
  copyMarkdownSources,
  groupOf,
  renderIndex,
  SITE_URL,
} from "../scripts/build-agent-surface.mjs";

const DOCS = join(import.meta.dirname, "..");

/** Write a fixture file at `root/relPath`, creating any parent dirs it needs. */
function writeFixtureFile(root: string, relPath: string, content: string) {
  const abs = join(root, ...relPath.split("/"));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** Every file under `root`, as paths relative to it, POSIX-separated. */
function listFilesRecursively(root: string, base = root): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const abs = join(root, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...listFilesRecursively(abs, base));
    } else {
      out.push(relative(base, abs).split(sep).join("/"));
    }
  }
  return out;
}

describe("groupOf", () => {
  it("groups by top-level directory", () => {
    expect(groupOf("guide/theming.md")).toBe("Guide");
    expect(groupOf("backend/templates.md")).toBe("Connect your backend");
  });

  it("titles a directory it has no override for", () => {
    expect(groupOf("brand-new-section/page.md")).toBe("Brand New Section");
  });

  it("puts root-level pages in Overview", () => {
    expect(groupOf("index.md")).toBe("Overview");
    expect(groupOf("license-faq.md")).toBe("Overview");
  });
});

describe("collectPages", () => {
  it("finds every English page except the generated changelog", () => {
    const pages = collectPages(DOCS);
    const paths = pages.map((p) => p.path);
    expect(paths).toContain("guide/theming.md");
    expect(paths).toContain("index.md");
    expect(paths).not.toContain("changelog.md");
  });

  it("excludes the German mirror", () => {
    expect(collectPages(DOCS).some((p) => p.path.startsWith("de/"))).toBe(false);
  });

  it("builds extensionless absolute urls, matching cleanUrls", () => {
    const theming = collectPages(DOCS).find((p) => p.path === "guide/theming.md");
    expect(theming?.url).toBe(`${SITE_URL}/guide/theming`);
  });

  it("maps a directory index to its directory url, not to /index", () => {
    const qualityIndex = collectPages(DOCS).find((p) => p.path === "quality/index.md");
    expect(qualityIndex?.url).toBe(`${SITE_URL}/quality/`);
  });

  it("maps the home page to the site root", () => {
    expect(collectPages(DOCS).find((p) => p.path === "index.md")?.url).toBe(`${SITE_URL}/`);
  });

  it("reads title and description from frontmatter", () => {
    const theming = collectPages(DOCS).find((p) => p.path === "guide/theming.md");
    expect(theming?.title).toBe("Theming");
    expect(theming?.description).toContain("CSS variables");
  });

  it("throws, naming the file, when a page has no description", () => {
    // The generator is the enforcement point: a page added without a
    // description must fail the build rather than silently vanish from the
    // index, which is how an index quietly stops covering the docs.
    expect(() => collectPages(join(import.meta.dirname, "fixtures/no-description"))).toThrow(
      /missing-description\.md/,
    );
  });

  it("uses the site title for the home page when it has no frontmatter title or H1", () => {
    const pages = collectPages(DOCS);
    const homePage = pages.find((p) => p.path === "index.md");
    expect(homePage?.title).toBe("Templatical");
    expect(homePage?.title).not.toBe("index.md");
  });

  it("derives a title from the page path when there is no frontmatter title or H1", () => {
    const pages = collectPages(join(import.meta.dirname, "fixtures/no-title-no-h1"));
    const page = pages.find((p) => p.path === "some-new-page.md");
    expect(page?.title).toBe("Some New Page");
    expect(page?.title).not.toBe("some-new-page.md");
  });

  it("derives a nested index's title from its directory, not a literal null or a path with a slash", () => {
    // widgets/index.md carries no title field and no body H1, so the title
    // falls back to its parent directory segment, title-cased. A directory
    // index is not the root page, so it does not fall through to SITE_TITLE,
    // and its "index" basename must not leak into the title as a literal
    // string or as part of a path fragment like "Widgets/index".
    const pages = collectPages(join(import.meta.dirname, "fixtures/nested-titleless"));
    const page = pages.find((p) => p.path === "widgets/index.md");
    expect(page?.title).toBe("Widgets");
    expect(page?.title).not.toBe("Widgets/index");
  });
});

describe("renderIndex", () => {
  it("emits one link line per page, with its description", () => {
    const out = renderIndex(
      [
        {
          path: "guide/theming.md",
          url: `${SITE_URL}/guide/theming`,
          group: "Guide",
          title: "Theming",
          description: "Customize the editor.",
          body: "",
        },
      ],
      { version: "0.30.0" },
    );
    expect(out).toContain("## Guide");
    expect(out).toContain(`- [Theming](${SITE_URL}/guide/theming): Customize the editor.`);
  });

  it("states the SDK version the docs describe", () => {
    const out = renderIndex([], { version: "0.30.0" });
    expect(out).toContain("0.30.0");
  });
});

describe("the committed artifacts", () => {
  it("llms.txt is what the generator produces", () => {
    const { index } = buildOutputs();
    expect(readFileSync(join(DOCS, "public/llms.txt"), "utf8")).toBe(index);
  });

  it("llms-full.txt is what the generator produces", () => {
    const { full } = buildOutputs();
    expect(readFileSync(join(DOCS, "public/llms-full.txt"), "utf8")).toBe(full);
  });

  it("llms-meta.json is what the generator produces", () => {
    const { meta } = buildOutputs();
    expect(JSON.parse(readFileSync(join(DOCS, "public/llms-meta.json"), "utf8"))).toEqual(meta);
  });

  it("excludes the changelog from the full corpus, which is most of the bytes", () => {
    const { full } = buildOutputs();
    // The changelog is ~27% of the English tree and answers no "how do I"
    // question; public/changelog.json already serves it machine-readably.
    expect(full).not.toContain("Version Packages");
    expect(full.length).toBeLessThan(600_000);
  });

  it("shows a page's entry with exactly one heading, not the body's own leading H1 too", () => {
    // cloud/getting-started.md's frontmatter title ("Getting Started with
    // Cloud") differs from its body's own H1 ("Getting Started") — the exact
    // case that made the duplicate visible as two different headings back to
    // back, rather than merely a repeated one.
    const { full } = buildOutputs();
    const sourceLine = `Source: ${SITE_URL}/cloud/getting-started`;
    const sourceIndex = full.indexOf(sourceLine);
    const entryStart = full.lastIndexOf("\n---\n", sourceIndex) + 1;
    const entryEnd = full.indexOf("\n---\n", sourceIndex);
    const entry = full.slice(entryStart, entryEnd === -1 ? full.length : entryEnd);
    const headingLines = entry.split("\n").filter((line) => line.startsWith("# "));
    expect(headingLines).toEqual(["# Getting Started with Cloud"]);
  });

  it("reports the SDK version from the editor package, not a literal", () => {
    const { meta } = buildOutputs();
    const editor = JSON.parse(
      readFileSync(join(DOCS, "../../packages/editor/package.json"), "utf8"),
    );
    expect(meta.sdkVersion).toBe(editor.version);
  });
});

describe("the buildEnd hook", () => {
  it("is configured, so pages are fetchable as raw markdown", () => {
    // Rendered HTML mangles this product's own syntax: {{ tag }} compiles as a
    // Vue interpolation and markdown-it-attrs eats a trailing {% if %}. Serving
    // source markdown is the fix, and it is what an agent should fetch.
    const config = readFileSync(join(DOCS, ".vitepress/config.ts"), "utf8");
    expect(config).toContain("buildEnd");
    expect(config).toContain("copyMarkdownSources");
  });
});

describe("copyMarkdownSources", () => {
  // A page with frontmatter and a merge-tag token, used to prove the copy is
  // byte-for-byte — this function must never transform content.
  const NESTED_FIXTURE = `---
title: Nested
description: A nested fixture page with frontmatter and a merge-tag token.
---

# Nested

Hello {{ first_name }}, your order {{ order.id }} shipped.
`;

  let srcDir: string;
  let destDir: string;

  beforeEach(() => {
    srcDir = mkdtempSync(join(tmpdir(), "agent-surface-src-"));
    destDir = mkdtempSync(join(tmpdir(), "agent-surface-dest-"));

    // Root-level page.
    writeFixtureFile(srcDir, "root.md", "# Root\n\nRoot page content.\n");
    // Nested page — proves the destination directory is created — and
    // carries frontmatter plus merge-tag tokens for the byte-identical check.
    writeFixtureFile(srcDir, "guide/nested.md", NESTED_FIXTURE);
    // de/ root-level and nested pages — the walker's one inversion of
    // SKIP_DIRS: German pages are copied, unlike every other skipped dir.
    writeFixtureFile(srcDir, "de/root.md", "# Root (DE)\n\nGerman root content.\n");
    writeFixtureFile(srcDir, "de/guide/nested.md", "# Nested (DE)\n\nGerman nested content.\n");
    // One page under each SKIP_DIRS entry other than "de" — none may reach
    // the output, and their containing directory is never even walked.
    writeFixtureFile(srcDir, "node_modules/skip.md", "# Skip\n\nnode_modules.\n");
    writeFixtureFile(srcDir, ".vitepress/skip.md", "# Skip\n\n.vitepress.\n");
    writeFixtureFile(srcDir, "public/skip.md", "# Skip\n\npublic.\n");
    writeFixtureFile(srcDir, "tests/skip.md", "# Skip\n\ntests.\n");
    writeFixtureFile(srcDir, "scripts/skip.md", "# Skip\n\nscripts.\n");
    // Non-.md files, at top level and inside a copied directory — prove the
    // extension filter operates independently of the directory filter.
    writeFixtureFile(srcDir, "readme.txt", "not markdown\n");
    writeFixtureFile(srcDir, "guide/notes.txt", "not markdown either\n");
  });

  afterEach(() => {
    rmSync(srcDir, { recursive: true, force: true });
    rmSync(destDir, { recursive: true, force: true });
  });

  it("returns exactly the markdown pages, excluding every skip-dir except de/", () => {
    const copied = copyMarkdownSources(destDir, srcDir);
    expect([...copied].sort()).toEqual(
      ["root.md", "guide/nested.md", "de/root.md", "de/guide/nested.md"].sort(),
    );
  });

  it("returns relative, POSIX-separated paths — never a directory prefix or a backslash", () => {
    const copied = copyMarkdownSources(destDir, srcDir);
    for (const path of copied) {
      expect(path.startsWith("/")).toBe(false);
      expect(path.includes("\\")).toBe(false);
    }
    expect(copied).toContain("de/guide/nested.md");
  });

  it("writes exactly the copied pages to the output directory, creating nested dirs as needed", () => {
    copyMarkdownSources(destDir, srcDir);
    const onDisk = listFilesRecursively(destDir);
    expect(onDisk.sort()).toEqual(
      ["root.md", "guide/nested.md", "de/root.md", "de/guide/nested.md"].sort(),
    );
  });

  it("copies a page's content byte-for-byte, preserving frontmatter and merge-tag tokens", () => {
    copyMarkdownSources(destDir, srcDir);
    const dest = readFileSync(join(destDir, "guide/nested.md"), "utf8");
    expect(dest).toBe(NESTED_FIXTURE);
    expect(dest).toContain("{{ first_name }}");
    expect(dest).toContain("{{ order.id }}");
    expect(dest).toContain("title: Nested");
  });
});
