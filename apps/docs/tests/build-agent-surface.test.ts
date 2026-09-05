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

  it("reports the SDK version from the editor package, not a literal", () => {
    const { meta } = buildOutputs();
    const editor = JSON.parse(
      readFileSync(join(DOCS, "../../packages/editor/package.json"), "utf8"),
    );
    expect(meta.sdkVersion).toBe(editor.version);
  });
});
