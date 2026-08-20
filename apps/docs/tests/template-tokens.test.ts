import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createMarkdownRenderer } from "vitepress";

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Liquid/handlebars tokens the docs show as example syntax. They must survive
 * rendering verbatim: `markdown-it-attrs` (which VitePress enables, and which the
 * docs rely on for custom heading anchors like `{#mjml-tag-mapping}`) treats a
 * trailing `{...}` as an attribute block. A `{% if vip %}` that ends a table cell
 * or paragraph is therefore swallowed into the parent tag's attributes and
 * disappears from the page.
 *
 * The fix is always the same: use a markdown backtick code span, not raw
 * `<code v-pre>` HTML. `v-pre` guards against Vue interpolating `{{ }}`, which
 * `{% %}` never triggers, so it buys nothing here — and inside raw HTML the token
 * is a plain text node that attrs will consume.
 */
const TEMPLATE_TOKEN = /\{%[^%]*%\}|\{\{[^{}]*\}\}/g;

const FENCED_BLOCK = /^```[\s\S]*?^```/gm;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

function decodeEntities(html: string): string {
  return html
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const markdownFiles = execSync(
  [
    "find .",
    "-name '*.md'",
    "-not -path '*/node_modules/*'",
    "-not -path './.vitepress/dist/*'",
    "-not -path './.vitepress/cache/*'",
  ].join(" "),
  { cwd: docsRoot, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort();

let render: (src: string) => string;

beforeAll(async () => {
  const md = await createMarkdownRenderer(docsRoot, {}, "/");
  render = (src: string) => md.render(src);
}, 60_000);

describe("template tokens survive markdown rendering", () => {
  it("finds the markdown pages to check", () => {
    expect(markdownFiles.length).toBeGreaterThan(40);
    expect(markdownFiles).toContain("./guide/merge-tags.md");
    expect(markdownFiles).toContain("./de/guide/merge-tags.md");
  });

  it.each(markdownFiles)("%s", (file) => {
    const raw = readFileSync(path.join(docsRoot, file), "utf8").replace(FRONTMATTER, "");
    // Fenced blocks are opaque to markdown-it-attrs. Swap them for a marker so
    // block boundaries survive while their tokens stay out of the counts.
    const source = raw.replace(FENCED_BLOCK, "<!-- fence -->");
    const tokens = [...new Set(source.match(TEMPLATE_TOKEN) ?? [])];
    if (tokens.length === 0) return;

    const html = decodeEntities(render(source));

    const lost = tokens
      .map((token) => ({
        token,
        expected: countOf(source, token),
        rendered: countOf(html, token),
      }))
      .filter(({ expected, rendered }) => rendered < expected);

    expect(lost).toEqual([]);
  });

  /**
   * `{{ }}` has a second hazard the render check above cannot see. Markdown-it
   * turns a backtick span into `<code>{{first_name}}</code>` with the token
   * intact — and then VitePress hands that HTML to Vue, which compiles the
   * mustache as an interpolation and renders an empty element. The page passes
   * every markdown assertion and still shows nothing.
   *
   * Three constructs opt out of Vue compilation, and a mustache must sit in one
   * of them: a fenced code block (VitePress adds `v-pre` itself), an explicit
   * `<code v-pre>`, or a `::: v-pre` container (which is how the generated
   * changelog carries merge-tag syntax in prose).
   */
  const VPRE_CODE = /<code v-pre>[\s\S]*?<\/code>/g;
  const VPRE_CONTAINER = /^::: v-pre$[\s\S]*?^:::$/gm;
  const MUSTACHE = /\{\{[^{}]*\}\}/g;

  it.each(markdownFiles)("%s guards every mustache from Vue", (file) => {
    const raw = readFileSync(path.join(docsRoot, file), "utf8").replace(
      FRONTMATTER,
      "",
    );
    const unguarded = raw
      .replace(FENCED_BLOCK, "")
      .replace(VPRE_CONTAINER, "")
      .replace(VPRE_CODE, "");

    expect(unguarded.match(MUSTACHE) ?? []).toEqual([]);
  });

  it("renders a v-pre-guarded mustache into the merge-tags page", () => {
    const source = readFileSync(path.join(docsRoot, "guide/merge-tags.md"), "utf8");
    const html = decodeEntities(render(source));

    // The markdown renderer is not the hazard for `{{ }}` — Vue is. Prove the
    // guarded form still reaches the compiler with its token intact.
    expect(html).toContain("<code v-pre>{{first_name}}</code>");
  });

  it("renders the liquid preset's logic tag into the syntax-presets table", () => {
    const source = readFileSync(path.join(docsRoot, "guide/merge-tags.md"), "utf8");
    const liquidRow = source.split("\n").find((line) => line.startsWith("| `'liquid'`"));
    expect(liquidRow).toContain("{% if vip %}");

    const html = decodeEntities(render(source));
    // the cell renders its token, and carries no attributes scavenged from it
    expect(html).toContain("<td><code>{% if vip %}</code></td>");
  });
});
