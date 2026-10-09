import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Each framework page opens its example on StackBlitz from a link alone in its
 * paragraph, which custom.css draws as the same pill as a playground link. The
 * link must open the example the page includes code from, on main, in every
 * locale, and the pill rule must cover it wherever it covers a playground link.
 */

// Pages whose example doesn't run on StackBlitz, and why. Each carries no
// StackBlitz link at all. Next.js 16: StackBlitz's runtime has no native
// Turbopack bindings, and in webpack mode Next fails its own "workStore"
// invariant there (500), while the same app renders locally. Nuxt 4: `nuxt dev`
// dies inside StackBlitz's BroadcastChannel built-in before the app loads.
const WITHOUT_STACKBLITZ = new Set(["nextjs.md", "nuxt.md"]);

const DOCS = join(import.meta.dirname, "..");
const REPO = join(DOCS, "../..");

const PAGES = readdirSync(join(DOCS, "frameworks"))
  .filter((file) => file.endsWith(".md"))
  .sort();

const LOCALES: Array<[string, string, string]> = [
  ["English", "frameworks", "Open in StackBlitz"],
  ["German", "de/frameworks", "In StackBlitz öffnen"],
];

const STACKBLITZ = /https:\/\/stackblitz\.com\/[^\s)]*/g;
const PLAY_PILL =
  '.vp-doc p > a[href^="https://play.templatical.com/scenes/"]:only-child';
const STACKBLITZ_PILL =
  '.vp-doc p > a[href^="https://stackblitz.com/github/templatical/sdk/"]:only-child';

/** The example a page includes code from, read from its first `<<<` include. */
function includedExample(source: string): string {
  return /^<<< @\/\.\.\/\.\.\/examples\/([^/]+)\//m.exec(source)?.[1] ?? "";
}

describe.each(LOCALES)("%s framework pages", (_locale, dir, label) => {
  it("exist for every English page", () => {
    expect(PAGES.length).toBeGreaterThan(0);
    expect(PAGES.filter((page) => !existsSync(join(DOCS, dir, page)))).toEqual(
      [],
    );
  });

  it.each(PAGES.filter((page) => !WITHOUT_STACKBLITZ.has(page)))(
    "%s opens its own example on StackBlitz from a link alone in its paragraph",
    (page) => {
      const source = readFileSync(join(DOCS, dir, page), "utf8");
      const example = includedExample(source);
      expect(existsSync(join(REPO, "examples", example))).toBe(true);
      const url = `https://stackblitz.com/github/templatical/sdk/tree/main/examples/${example}`;
      expect([...source.matchAll(STACKBLITZ)].map(([match]) => match)).toEqual([
        url,
      ]);
      expect(source).toContain(`\n\n[${label}](${url})\n\n`);
    },
  );

  it.each([...WITHOUT_STACKBLITZ])("%s carries no StackBlitz link", (page) => {
    expect(PAGES).toContain(page);
    const source = readFileSync(join(DOCS, dir, page), "utf8");
    expect([...source.matchAll(STACKBLITZ)]).toEqual([]);
  });
});

describe("custom.css", () => {
  it("draws a StackBlitz link as the playground pill, in every state", () => {
    const css = readFileSync(join(DOCS, ".vitepress/theme/custom.css"), "utf8");
    const selectorLists = css
      .split("}")
      .map((block) => block.split("{")[0])
      .filter((selectors) => selectors.includes(PLAY_PILL));
    expect(selectorLists.length).toBeGreaterThan(0);
    for (const selectors of selectorLists) {
      const suffix = (selectors.split(PLAY_PILL)[1].split(",")[0] ?? "").trim();
      expect(selectors).toContain(`${STACKBLITZ_PILL}${suffix}`);
    }
  });
});
