// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  findOpenTagEnd,
  getTagAttrValue,
  type MergeTag,
  type SyntaxPreset,
} from "@templatical/types";
import { convertMergeTagsToValues } from "@templatical/renderer";
import { normalizeMergeTagsInHtml } from "../src/utils/normalizeMergeTagMarkup";

/**
 * F6 / #543 / #548 — a consumer-configured syntax whose delimiters are angle
 * brackets. This is the one syntax where an implementation that builds spans by
 * string concatenation passes every liquid test and still ships broken: it
 * writes a raw `<` into an attribute and yields markup no scanner can re-read.
 *
 * **This file runs on jsdom, not happy-dom** (which the rest of the package
 * uses). happy-dom parses `<% $email %>` in text position as a bogus element
 * rather than as text, so the raw-token case — the one that matters here —
 * cannot be exercised under it. jsdom follows the WHATWG tag-open state, where
 * `<` followed by a non-alpha character is emitted as a literal character, and
 * so matches what the editor actually sees in a browser.
 *
 * Note what the serializer does with each position, since the two differ and
 * both are asserted below:
 *   - **attribute** values escape only `&`, `"` and U+00A0, so `<` and `>`
 *     survive verbatim. `findOpenTagEnd` is quote-aware precisely for this.
 *   - **text** escapes `<` and `>`, so an undeclared tag — whose label falls
 *     back to the raw token — reads `&lt;% … %&gt;` as the span's inner text.
 */

const SMARTY: SyntaxPreset = {
  value: /<%\s*\$[^%]*%>/g,
  logic: /<%\s*(if|else|endif)[^%]*%>/g,
};

const SMARTY_TAGS: MergeTag[] = [
  { label: "Email", value: "<% $email %>", sample: "ada@example.com" },
];

/**
 * The `<!doctype html><body>…</body>` wrapper around the parse input is
 * load-bearing, and these are the cases that prove it. They live here rather
 * than in the happy-dom suite because happy-dom keeps `<style>` and `<meta>` in
 * the body regardless, so the assertions would hold there whatever the parser
 * did.
 *
 * Without the wrapper the parser starts in its "before head" insertion mode and
 * routes leading whitespace, `<style>`, `<meta>` and `<title>` into `<head>`,
 * where reading `body.innerHTML` back silently discards them. Rich text loaded
 * from a store can legitimately carry any of these, and this function's contract
 * is to return its input untouched apart from the tokens it converts.
 *
 * Every fixture carries a token on purpose: with none, the zero-replacement
 * short-circuit returns the input string without ever parsing, and the
 * assertion would pass whatever the parser did.
 *
 * A CodeQL "unsafe HTML constructed from library input" alert suggests dropping
 * the wrapper. Doing so silently loses all of the below while leaving
 * `<img onerror>` untouched, so it removes no attack surface and costs
 * correctness. These tests fail if it is ever applied.
 */
describe("the parse wrapper preserves head-ish content", () => {
  const PLAIN: MergeTag[] = [{ label: "Last Name", value: "{{last_name}}" }];
  const LIQUID: SyntaxPreset = {
    value: /\{\{.+?\}\}/g,
    logic: /\{%-?\s*(\w+).*?-?%\}/g,
  };
  const TAG = '<span data-merge-tag="{{last_name}}">Last Name</span>';

  it("keeps leading whitespace", () => {
    expect(
      normalizeMergeTagsInHtml("  <p>{{last_name}}</p>", PLAIN, LIQUID),
    ).toBe(`  <p>${TAG}</p>`);
  });

  it("keeps a <style> block", () => {
    expect(
      normalizeMergeTagsInHtml(
        "<style>p{color:red}</style><p>{{last_name}}</p>",
        PLAIN,
        LIQUID,
      ),
    ).toBe(`<style>p{color:red}</style><p>${TAG}</p>`);
  });

  it("keeps a <meta> element", () => {
    expect(
      normalizeMergeTagsInHtml(
        '<meta charset="utf-8"><p>{{last_name}}</p>',
        PLAIN,
        LIQUID,
      ),
    ).toBe(`<meta charset="utf-8"><p>${TAG}</p>`);
  });

  it("keeps a <title> element", () => {
    expect(
      normalizeMergeTagsInHtml(
        "<title>t</title><p>{{last_name}}</p>",
        PLAIN,
        LIQUID,
      ),
    ).toBe(`<title>t</title><p>${TAG}</p>`);
  });
});

describe("normalizeMergeTagsInHtml with an angle-bracket syntax", () => {
  it("wraps a bare token in text and resolves its label", () => {
    const result = normalizeMergeTagsInHtml(
      "<p>Mail: <% $email %></p>",
      SMARTY_TAGS,
      SMARTY,
    );

    expect(result).toBe(
      '<p>Mail: <span data-merge-tag="<% $email %>">Email</span></p>',
    );
  });

  // The reporter's words for the part #552 left unfixed: the pill "must show
  // its human-readable label … never the raw `<% ... %>` syntax".
  it("writes the raw token as the attribute value, readable by getTagAttrValue", () => {
    const result = normalizeMergeTagsInHtml(
      "<p>Mail: <% $email %></p>",
      SMARTY_TAGS,
      SMARTY,
    );

    // Read the open tag with the quote-aware scanner, not `indexOf(">")` —
    // the first `>` in this markup is the one inside the token itself, which
    // is the truncation `findOpenTagEnd` was added for (#544).
    const open = result.indexOf("<span");
    const attrs = result.substring(open + 5, findOpenTagEnd(result, open + 5));

    expect(getTagAttrValue(attrs, "data-merge-tag")).toBe("<% $email %>");
  });

  it("leaves an angle-bracket token in an href byte-identical", () => {
    const input = '<p><a href="<% $email %>">Mail me</a></p>';

    expect(normalizeMergeTagsInHtml(input, SMARTY_TAGS, SMARTY)).toBe(input);
  });

  it("escapes the raw token when it is used as an undeclared tag's label", () => {
    const result = normalizeMergeTagsInHtml(
      "<p><% $nickname %></p>",
      SMARTY_TAGS,
      SMARTY,
    );

    expect(result).toBe(
      '<p><span data-merge-tag="<% $nickname %>">&lt;% $nickname %&gt;</span></p>',
    );
  });

  it("is idempotent over its own output", () => {
    const once = normalizeMergeTagsInHtml(
      "<p>Mail: <% $email %></p>",
      SMARTY_TAGS,
      SMARTY,
    );

    expect(normalizeMergeTagsInHtml(once, SMARTY_TAGS, SMARTY)).toBe(once);
  });

  // What stored content looks like after the user edits the block: TipTap
  // re-serializes the value entity-encoded (#548). Re-normalizing must leave it
  // alone rather than treating the escaped text as a fresh token.
  it("leaves the entity-encoded stored shape byte-identical", () => {
    const stored =
      '<p>Mail: <span data-merge-tag="&lt;% $email %&gt;">Email</span></p>';

    expect(normalizeMergeTagsInHtml(stored, SMARTY_TAGS, SMARTY)).toBe(stored);
  });

  it("puts the token, not the label, into the rendered output", () => {
    const normalized = normalizeMergeTagsInHtml(
      "<p>Mail: <% $email %></p>",
      SMARTY_TAGS,
      SMARTY,
    );

    expect(convertMergeTagsToValues(normalized)).toBe(
      "<p>Mail: <% $email %></p>",
    );
  });

  it("puts the token into the rendered output from the entity-encoded shape too", () => {
    const stored =
      '<p>Mail: <span data-merge-tag="&lt;% $email %&gt;">Email</span></p>';

    expect(convertMergeTagsToValues(stored)).toBe("<p>Mail: <% $email %></p>");
  });
});
