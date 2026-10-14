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
    ["de/index.md", "https://docs.templatical.com/de/"],
    ["de/guide/theming.md", "https://docs.templatical.com/de/guide/theming"],
  ])("%s → %s", async (relativePath, expected) => {
    const head = await headFor(relativePath);
    expect(canonicalOf(head)).toEqual([expected]);
    expect(ogUrlOf(head)).toEqual([expected]);
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
