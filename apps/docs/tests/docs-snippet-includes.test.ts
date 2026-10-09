import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs generator, no types
import { resolveSnippetPath, snippetIncludes } from "../scripts/build-agent-surface.mjs";

/**
 * Code on the Frameworks pages comes straight from examples/ through VitePress
 * `<<<` includes, so the docs cannot drift from the code CI runs. These guards
 * keep the includes honest in every locale. The VitePress build also fails on a
 * missing file, but only for a build someone runs; this runs with the tests.
 */
const DOCS = join(import.meta.dirname, "..");
const SKIP = new Set(["public", "node_modules", ".vitepress", "tests", "scripts"]);

function markdownFiles(dir = DOCS, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (!SKIP.has(name)) markdownFiles(abs, out);
      continue;
    }
    if (name.endsWith(".md")) out.push(abs);
  }
  return out;
}

const pages = markdownFiles()
  .map((abs) => ({
    abs,
    rel: relative(DOCS, abs).split(sep).join("/"),
    includes: snippetIncludes(readFileSync(abs, "utf8")) as string[],
  }))
  .filter((page) => page.includes.length > 0);

describe("docs code includes", () => {
  it("are used by every Frameworks page, in both locales", () => {
    const withIncludes = pages.map((page) => page.rel);
    for (const name of ["react", "nextjs", "react-router", "nuxt", "sveltekit"]) {
      expect(withIncludes).toContain(`frameworks/${name}.md`);
      expect(withIncludes).toContain(`de/frameworks/${name}.md`);
    }
  });

  it("each name a file that exists", () => {
    const missing = pages.flatMap((page) =>
      page.includes
        .filter((raw) => !existsSync(resolveSnippetPath(raw, page.abs, DOCS)))
        .map((raw) => `${page.rel}: <<< ${raw}`),
    );
    expect(missing).toEqual([]);
  });

  it("are the same files, in the same order, in each German page as in its English page", () => {
    for (const page of pages.filter((p) => p.rel.startsWith("de/"))) {
      const english = pages.find((p) => p.rel === page.rel.slice("de/".length));
      expect(english?.includes, page.rel).toEqual(page.includes);
    }
  });
});
