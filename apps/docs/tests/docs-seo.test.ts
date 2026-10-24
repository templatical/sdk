import { describe, expect, it } from "vitest";
import config from "../.vitepress/config";

type HeadEntry = [string, Record<string, string>];

async function headFor(
  relativePath: string,
  filePath = relativePath,
): Promise<HeadEntry[]> {
  const transform = config.transformHead;
  expect(typeof transform).toBe("function");
  const head = await transform!({ pageData: { relativePath, filePath } } as never);
  return (head ?? []) as HeadEntry[];
}

const canonicalOf = (head: HeadEntry[]) =>
  head
    .filter(([tag, attrs]) => tag === "link" && attrs.rel === "canonical")
    .map(([, attrs]) => attrs.href);

const ogUrlOf = (head: HeadEntry[]) =>
  head
    .filter(([tag, attrs]) => tag === "meta" && attrs.property === "og:url")
    .map(([, attrs]) => attrs.content);

/**
 * A single site-wide canonical tells search engines that every page duplicates
 * the home page. Each page names its own URL, computed the way VitePress's
 * sitemap computes it, so the two can never disagree.
 */
describe("per-page canonical URL", () => {
  it.each([
    ["index.md", "https://docs.templatical.com/"],
    ["guide/theming.md", "https://docs.templatical.com/guide/theming"],
    ["backend/index.md", "https://docs.templatical.com/backend/"],
    ["backend/ai.md", "https://docs.templatical.com/backend/ai"],
    ["api/ai-kit.md", "https://docs.templatical.com/api/ai-kit"],
    ["guide/bring-your-own-ai.md", "https://docs.templatical.com/guide/bring-your-own-ai"],
    ["backend/collaboration.md", "https://docs.templatical.com/backend/collaboration"],
    ["api/operations.md", "https://docs.templatical.com/api/operations"],
    ["de/backend/ai.md", "https://docs.templatical.com/de/backend/ai"],
    ["de/api/ai-kit.md", "https://docs.templatical.com/de/api/ai-kit"],
    ["de/guide/bring-your-own-ai.md", "https://docs.templatical.com/de/guide/bring-your-own-ai"],
    ["de/backend/collaboration.md", "https://docs.templatical.com/de/backend/collaboration"],
    ["de/api/operations.md", "https://docs.templatical.com/de/api/operations"],
    ["de/index.md", "https://docs.templatical.com/de/"],
    ["de/guide/theming.md", "https://docs.templatical.com/de/guide/theming"],
  ])("%s → %s", async (relativePath, expected) => {
    const head = await headFor(relativePath);
    expect(canonicalOf(head)).toEqual([expected]);
    expect(ogUrlOf(head)).toEqual([expected]);
    expect(head).toContainEqual([
      "link",
      { rel: "alternate", type: "text/markdown", href: `/${relativePath}` },
    ]);
  });

  it("emits none for a page without a markdown source (the 404)", async () => {
    const head = await headFor("404.md", "");
    expect(canonicalOf(head)).toEqual([]);
    expect(ogUrlOf(head)).toEqual([]);
  });

  it("keeps the markdown twin link beside the canonical", async () => {
    expect(await headFor("guide/theming.md")).toContainEqual([
      "link",
      { rel: "alternate", type: "text/markdown", href: "/guide/theming.md" },
    ]);
  });

  it("declares no site-wide canonical or og:url", () => {
    const head = (config.head ?? []) as HeadEntry[];
    expect(canonicalOf(head)).toEqual([]);
    expect(ogUrlOf(head)).toEqual([]);
  });
});

describe("per-page social metadata", () => {
  it.each([
    [
      "guide/theming.md",
      "Theming",
      "Customize the editor's appearance with CSS variables, theme overrides, dark mode, and custom fonts.",
      "Theming",
    ],
    [
      "de/guide/theming.md",
      "Theming",
      "Passen Sie das Erscheinungsbild des Editors mit CSS-Variablen, Theme-Überschreibungen, Dark Mode und benutzerdefinierten Schriftarten an.",
      "Theming",
    ],
    [
      "index.md",
      "",
      "Templatical is an embeddable drag-and-drop email editor SDK — saving, versioning, comments, and rendering wired to your own backend.",
      "Templatical — Drag-and-Drop Email Editor",
    ],
  ])(
    "%s emits one exact title and description per social tag",
    async (relativePath, title, description, expectedTitle) => {
      const transform = config.transformHead!;
      const head = [
        ...(config.head ?? []),
        ...((await transform({
          pageData: {
            relativePath,
            filePath: relativePath,
            title,
            frontmatter: { description },
          },
        } as never)) ?? []),
      ] as HeadEntry[];
      for (const [key, expected] of [
        ["og:title", expectedTitle],
        ["og:description", description],
        ["twitter:title", expectedTitle],
        ["twitter:description", description],
      ]) {
        expect
          .soft(
            head
              .filter(
                ([tag, attrs]) =>
                  tag === "meta" &&
                  (attrs.property === key || attrs.name === key),
              )
              .map(([, attrs]) => attrs.content),
            key,
          )
          .toEqual([expected]);
      }
      const fallback = [
        ...(config.head ?? []),
        ...(await headFor("404.md", "")),
      ] as HeadEntry[];
      for (const key of ["og:title", "twitter:title"]) {
        expect(
          fallback
            .filter(
              ([tag, attrs]) =>
                tag === "meta" &&
                (attrs.property === key || attrs.name === key),
            )
            .map(([, attrs]) => attrs.content),
        ).toEqual(["Templatical — Drag-and-Drop Email Editor"]);
      }
      for (const key of ["og:description", "twitter:description"]) {
        expect(
          fallback
            .filter(
              ([tag, attrs]) =>
                tag === "meta" &&
                (attrs.property === key || attrs.name === key),
            )
            .map(([, attrs]) => attrs.content),
        ).toEqual([
          "Production-ready drag-and-drop email editor. Merge tags, custom blocks, dark mode, and MJML output.",
        ]);
      }
    },
  );
});
