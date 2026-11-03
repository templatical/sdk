import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types";
import type { Block } from "@templatical/types";
import { renderToMjml } from "../src";
import { decodeStyleReferences } from "../src/rich-text";

/**
 * MJML inlines the rich-text stylesheet with juice, which re-parses the style
 * attribute of every `<p>`, `<ul>`, `<ol>` and `<li>` it matches. Juice splits
 * on `;` without decoding character references, so the `;` that ends
 * `&apos;` or `&nbsp;` cut a declaration in two and the compile threw
 * `Cannot read properties of undefined (reading 'indexOf')`. BeeFree's
 * TinyMCE output and import-mjml's serializer both write such references.
 */
async function compile(blocks: Block[]): Promise<string> {
  const mjml = await renderToMjml({
    ...createDefaultTemplateContent(),
    blocks,
  });
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

describe("character references in rich-text style attributes", () => {
  it("compiles a paragraph whose <p> style holds &apos;", async () => {
    const html = await compile([
      createParagraphBlock({
        content: `<p style="font-family: Monda, &apos;Courier New&apos;, monospace;">Hi</p>`,
      }),
    ]);
    expect(html).toMatch(
      /<p style="[^"]*font-family: Monda, 'Courier New', monospace[^"]*">Hi<\/p>/,
    );
  });

  it("compiles every reference that ends in a semicolon", async () => {
    for (const style of [
      "font-family: &#39;Courier New&#39;, monospace",
      "font-family: &#x27;Courier New&#x27;, monospace",
      "font-family: &quot;Courier New&quot;, monospace",
      "font-family: Arial&nbsp;Black",
      "font-family: Arial&#160;Black",
    ]) {
      await expect(
        compile([
          createParagraphBlock({ content: `<p style="${style}">Hi</p>` }),
        ]),
      ).resolves.toContain(">Hi</p>");
    }
  });

  it("compiles a list item and a multi-paragraph title", async () => {
    const html = await compile([
      createParagraphBlock({
        content: `<ul><li style="font-family: &quot;Open Sans&quot;, Arial">One</li></ul>`,
      }),
      createTitleBlock({
        content: `<p style="font-family: &apos;Open Sans&apos;">A</p><p style="font-family: &apos;Open Sans&apos;">B</p>`,
      }),
    ]);
    expect(html).toMatch(/<li style="[^"]*font-family: 'Open Sans', Arial/);
    expect(html.match(/font-family: 'Open Sans'/g)?.length).toBe(3);
  });
});

describe("decodeStyleReferences", () => {
  it("writes the characters references stand for inside style attributes", () => {
    expect(
      decodeStyleReferences(
        `<p style="font-family: &apos;A&apos;, &#39;B&#39;, &#x27;C&#X27;; word-spacing: 1px&nbsp;">x</p>`,
      ),
    ).toBe(
      `<p style="font-family: 'A', 'B', 'C'; word-spacing: 1px${String.fromCharCode(0xa0)}">x</p>`,
    );
  });

  it("turns a double quote into a single one in a double-quoted attribute", () => {
    expect(
      decodeStyleReferences(
        `<span style="font-family: &quot;A&quot;, &#34;B&#x22;">x</span>`,
      ),
    ).toBe(`<span style="font-family: 'A', 'B'">x</span>`);
  });

  it("turns a single quote into a double one in a single-quoted attribute", () => {
    expect(
      decodeStyleReferences(
        `<span style='font-family: &apos;A&apos;, &quot;B&quot;'>x</span>`,
      ),
    ).toBe(`<span style='font-family: "A", "B"'>x</span>`);
  });

  it("keeps &amp;, < and >, other named references and invalid code points", () => {
    const html = `<p style="background: url(a.png?x=1&amp;y=2); content: &copy; &lt;&#60;&#x3E;&gt; &#0; &#x110000; &#55296;">x</p>`;
    expect(decodeStyleReferences(html)).toBe(html);
  });

  it("writes &#38; as &amp;", () => {
    expect(decodeStyleReferences(`<p style="content: A&#38;B">x</p>`)).toBe(
      `<p style="content: A&amp;B">x</p>`,
    );
  });

  it("leaves other attributes and text alone", () => {
    const html = `<p title="&apos;t&apos;" data-style="&apos;d&apos;">use style="&apos;x&apos;" &amp; more</p><a href="?a=1&amp;b=&#39;2&#39;">l</a>`;
    expect(decodeStyleReferences(html)).toBe(html);
  });

  it("finds the attribute in any case and among other attributes", () => {
    expect(
      decodeStyleReferences(
        `<P class="c" STYLE = "font-family: &apos;A&apos;" id="i">x</P>`,
      ),
    ).toBe(`<P class="c" STYLE = "font-family: 'A'" id="i">x</P>`);
  });

  it("returns content without a style attribute unchanged", () => {
    expect(decodeStyleReferences("<p>Plain &apos;text&apos;</p>")).toBe(
      "<p>Plain &apos;text&apos;</p>",
    );
  });

  // A `>` inside a quoted value doesn't end the tag.
  it("reads past a > inside an earlier attribute's value", () => {
    expect(
      decodeStyleReferences(
        `<p title="2 > 1" style="font-family: &apos;A&apos;">x</p>`,
      ),
    ).toBe(`<p title="2 > 1" style="font-family: 'A'">x</p>`);
  });

  it("rewrites the style attribute, never style text inside another value", () => {
    expect(
      decodeStyleReferences(
        `<p title='x style="&apos;t&apos;"' style="font-family: &apos;A&apos;">x</p>`,
      ),
    ).toBe(`<p title='x style="&apos;t&apos;"' style="font-family: 'A'">x</p>`);
  });

  it("steps over unquoted values, boolean attributes and a stray =", () => {
    expect(
      decodeStyleReferences(
        `<p data-x=a&apos;b hidden style="font-family: &apos;A&apos;">x</p>`,
      ),
    ).toBe(`<p data-x=a&apos;b hidden style="font-family: 'A'">x</p>`);
    expect(
      decodeStyleReferences(`<p = style="font-family: &apos;A&apos;">x</p>`),
    ).toBe(`<p = style="font-family: 'A'">x</p>`);
  });

  // As HTML reads it: after `hidden =`, the value is unquoted and runs to the
  // next space, so `style="font-family:` is hidden's value, not an attribute.
  it("reads a value after = and spaces as that attribute's", () => {
    const html = `<p hidden = style="font-family: &apos;A&apos;">x</p>`;
    expect(decodeStyleReferences(html)).toBe(html);
  });

  it("leaves a tag with an unterminated quote alone", () => {
    const html = `<p title="open style="font-family: &apos;A&apos;">x</p>`;
    expect(decodeStyleReferences(html)).toBe(html);
    // The tag ends, but a value's opening quote has no match inside it.
    const unmatched = `<p x"=" y>&apos;</p>`;
    expect(decodeStyleReferences(unmatched)).toBe(unmatched);
  });

  it("compiles a paragraph whose style follows a > in a title", async () => {
    const html = await compile([
      createParagraphBlock({
        content: `<p title="2 > 1" style="font-family: &apos;Courier New&apos;">Hi</p>`,
      }),
    ]);
    expect(html).toContain("font-family: 'Courier New'");
  });
});
