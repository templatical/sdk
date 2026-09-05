import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error — plain .mjs generator, no types
import {
  buildOutputs,
  collectPages,
  groupOf,
  renderIndex,
  SITE_URL,
} from "../scripts/build-agent-surface.mjs";

const DOCS = join(import.meta.dirname, "..");

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

  it("does not leak a directory prefix into the title for a nested titleless page", () => {
    // widgets/index.md with no title and no H1 used to yield "Widgets/index" —
    // a slash leaking into a machine-readable index. Taking the basename
    // (the last path segment) before stripping the extension fixes that, and
    // as a side effect the "is this an index page" check — which previously
    // only ever matched a literal top-level "index.md" — now also correctly
    // recognizes a nested directory index, same as the root case.
    const pages = collectPages(join(import.meta.dirname, "fixtures/nested-titleless"));
    const page = pages.find((p) => p.path === "widgets/index.md");
    expect(page?.title).toBe(null);
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
