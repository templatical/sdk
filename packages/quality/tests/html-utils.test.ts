import { describe, expect, it } from "vitest";
import {
  extractAnchors,
  extractText,
  hasNestedAnchors,
} from "../src/html-utils";

describe("extractAnchors", () => {
  it("returns href + text for a simple anchor", () => {
    const anchors = extractAnchors('<p><a href="/buy">Buy now</a></p>');
    expect(anchors).toHaveLength(1);
    expect(anchors[0].href).toBe("/buy");
    expect(anchors[0].text).toBe("Buy now");
    expect(anchors[0].hasImageWithAlt).toBe(false);
  });

  it("flattens nested formatting in text", () => {
    const anchors = extractAnchors(
      '<a href="/x">Hello <strong>world</strong></a>',
    );
    expect(anchors[0].text).toBe("Hello world");
  });

  it("captures empty anchor text", () => {
    const anchors = extractAnchors('<a href="/x"></a>');
    expect(anchors[0].text).toBe("");
    expect(anchors[0].hasImageWithAlt).toBe(false);
  });

  it("flags image-with-alt nested in anchor", () => {
    const anchors = extractAnchors(
      '<a href="/x"><img src="hero.png" alt="Hero"/></a>',
    );
    expect(anchors[0].text).toBe("");
    expect(anchors[0].hasImageWithAlt).toBe(true);
  });

  it("does not flag image-with-empty-alt", () => {
    const anchors = extractAnchors(
      '<a href="/x"><img src="hero.png" alt=""/></a>',
    );
    expect(anchors[0].hasImageWithAlt).toBe(false);
  });

  it("captures target and rel", () => {
    const anchors = extractAnchors(
      '<a href="/x" target="_blank" rel="noopener">x</a>',
    );
    expect(anchors[0].target).toBe("_blank");
    expect(anchors[0].rel).toBe("noopener");
  });

  it("returns null target/rel when missing", () => {
    const anchors = extractAnchors('<a href="/x">x</a>');
    expect(anchors[0].target).toBeNull();
    expect(anchors[0].rel).toBeNull();
  });

  it("returns empty array for HTML without anchors", () => {
    expect(extractAnchors("<p>no links here</p>")).toEqual([]);
  });

  it("flattens nested anchors to siblings (HTML5-spec parse)", () => {
    // Nested `<a>` is invalid HTML. htmlparser2 follows the HTML5 spec
    // and emits an implicit `</a>` when a second `<a>` opens, so the
    // two anchors are surfaced as siblings rather than parent/child.
    // Text that appears after the inner anchor's close (and before the
    // outer's stray `</a>`) is outside any open anchor and is therefore
    // not attributed — this matches the spec parse a browser would do.
    // The presence of nested-anchor markup itself is flagged separately
    // by the `a11y.link-nested-anchor` rule, which inspects the raw
    // input rather than this normalized list.
    const anchors = extractAnchors(
      '<a href="/outer">prefix <a href="/inner">inner</a> suffix</a>',
    );
    expect(anchors).toHaveLength(2);
    const outer = anchors.find((a) => a.href === "/outer")!;
    const inner = anchors.find((a) => a.href === "/inner")!;
    expect(outer.text).toBe("prefix");
    expect(inner.text).toBe("inner");
  });

  it("finalizes an unclosed anchor at end of input", () => {
    const anchors = extractAnchors('<a href="/x">no close');
    expect(anchors).toHaveLength(1);
    expect(anchors[0].href).toBe("/x");
    expect(anchors[0].text).toBe("no close");
  });
});

describe("hasNestedAnchors", () => {
  it("returns true when an anchor opens inside another", () => {
    expect(
      hasNestedAnchors(
        '<a href="/outer">x<a href="/inner">y</a></a>',
      ),
    ).toBe(true);
  });

  it("returns false for sibling anchors", () => {
    expect(
      hasNestedAnchors('<a href="/a">a</a><a href="/b">b</a>'),
    ).toBe(false);
  });

  it("returns false for a single anchor", () => {
    expect(hasNestedAnchors('<a href="/x">x</a>')).toBe(false);
  });

  it("returns false for HTML without anchors", () => {
    expect(hasNestedAnchors("<p>plain text</p>")).toBe(false);
  });

  it("ignores anchor-like tokens inside HTML comments", () => {
    expect(
      hasNestedAnchors(
        '<a href="/x">y<!-- <a href="/z"> --></a>',
      ),
    ).toBe(false);
  });

  it("returns true when nesting follows a closed earlier anchor", () => {
    expect(
      hasNestedAnchors(
        '<a href="/a">a</a><a href="/outer"><a href="/inner">x</a></a>',
      ),
    ).toBe(true);
  });
});

describe("extractText", () => {
  it("strips tags", () => {
    expect(extractText("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world",
    );
  });

  it("trims whitespace", () => {
    expect(extractText("<p>  spaced  </p>")).toBe("spaced");
  });

  it("returns empty string for empty content", () => {
    expect(extractText("<p></p>")).toBe("");
  });
});
