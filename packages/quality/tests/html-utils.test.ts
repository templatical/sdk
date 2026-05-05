import { describe, expect, it } from "vitest";
import { extractAnchors, extractText } from "../src/html-utils";

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
