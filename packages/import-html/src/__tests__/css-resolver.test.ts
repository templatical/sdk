import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { parseStyleSheet, resolveCssStyles } from "../css-resolver";

describe("parseStyleSheet", () => {
  it("parses a single rule with one declaration", () => {
    const rules = parseStyleSheet("p { color: red; }");
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(["p"]);
    expect(rules[0].declarations).toEqual({ color: "red" });
  });

  it("parses multiple selectors comma-separated", () => {
    const rules = parseStyleSheet("h1, h2 { color: blue; }");
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(["h1", "h2"]);
  });

  it("strips comments", () => {
    const rules = parseStyleSheet("/* comment */ p { color: red; }");
    expect(rules).toHaveLength(1);
    expect(rules[0].declarations).toEqual({ color: "red" });
  });

  it("strips !important markers", () => {
    const rules = parseStyleSheet("p { color: red !important; }");
    expect(rules[0].declarations).toEqual({ color: "red" });
  });

  it("skips @media at-rules entirely", () => {
    const rules = parseStyleSheet(
      "p { color: red; } @media (max-width: 600px) { p { color: blue; } }",
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].declarations).toEqual({ color: "red" });
  });

  it("skips @font-face", () => {
    const rules = parseStyleSheet(
      "@font-face { font-family: 'X'; src: url(x); } p { color: red; }",
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(["p"]);
  });

  it("skips selectors with pseudo-classes", () => {
    const rules = parseStyleSheet("a:hover { color: blue; } a { color: red; }");
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(["a"]);
  });

  it("returns empty for stylesheet with no usable rules", () => {
    expect(parseStyleSheet("")).toEqual([]);
    expect(parseStyleSheet("@media print {}")).toEqual([]);
  });

  it("handles multiple rules in source order", () => {
    const rules = parseStyleSheet("p { color: red; } p { color: blue; }");
    expect(rules).toHaveLength(2);
    expect(rules[0].declarations).toEqual({ color: "red" });
    expect(rules[1].declarations).toEqual({ color: "blue" });
  });

  it("skips a semicolon-terminated @charset at-rule, keeps the following rule", () => {
    // @charset has no `{...}` block — it terminates at the `;`. The stripper
    // must skip past the semicolon and still parse the trailing p rule.
    const rules = parseStyleSheet('@charset "UTF-8"; p { color: red; }');
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(["p"]);
    expect(rules[0].declarations).toEqual({ color: "red" });
  });

  it("skips a semicolon-terminated @import at-rule, keeps the following rule", () => {
    const rules = parseStyleSheet(
      "@import url('https://x/reset.css'); h1 { color: blue; }",
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(["h1"]);
    expect(rules[0].declarations).toEqual({ color: "blue" });
  });

  it("skips an @import with no trailing semicolon (runs to end of source)", () => {
    // No `;` and no `{` after the @import means the stripper consumes to EOF.
    const rules = parseStyleSheet("@import url('x.css')");
    expect(rules).toEqual([]);
  });
});

describe("resolveCssStyles", () => {
  it("applies a rule to a matching element", () => {
    const $ = load(
      "<html><head><style>p { color: red; }</style></head><body><p>hi</p></body></html>",
    );
    resolveCssStyles($);
    expect($("p").attr("style")).toBe("color: red");
    expect($("style").length).toBe(0);
  });

  it("inline styles override resolved rule declarations", () => {
    const $ = load(
      '<html><head><style>p { color: red; }</style></head><body><p style="color: blue">hi</p></body></html>',
    );
    resolveCssStyles($);
    expect($("p").attr("style")).toContain("color: blue");
    expect($("p").attr("style")).not.toContain("red");
  });

  it("merges resolved declarations with non-overlapping inline", () => {
    const $ = load(
      '<html><head><style>p { color: red; }</style></head><body><p style="font-size: 14px">hi</p></body></html>',
    );
    resolveCssStyles($);
    const style = $("p").attr("style") ?? "";
    expect(style).toContain("color: red");
    expect(style).toContain("font-size: 14px");
  });

  it("@media rules are not applied", () => {
    const $ = load(
      "<html><head><style>@media (max-width: 600px) { p { color: red; } }</style></head><body><p>hi</p></body></html>",
    );
    resolveCssStyles($);
    expect($("p").attr("style")).toBeUndefined();
  });

  it("class selectors apply to matching elements", () => {
    const $ = load(
      '<html><head><style>.btn { background: yellow; }</style></head><body><a class="btn">click</a></body></html>',
    );
    resolveCssStyles($);
    expect($("a").attr("style")).toBe("background: yellow");
  });

  it("does nothing when no <style> tags exist", () => {
    const $ = load("<html><body><p>hi</p></body></html>");
    resolveCssStyles($);
    expect($("p").attr("style")).toBeUndefined();
  });

  it("removes <style> tags after resolution", () => {
    const $ = load(
      "<html><head><style>p { color: red; }</style></head><body><p>hi</p></body></html>",
    );
    resolveCssStyles($);
    expect($("style").length).toBe(0);
  });

  it("later rules override earlier rules in source order", () => {
    const $ = load(
      "<html><head><style>p { color: red; } p { color: green; }</style></head><body><p>hi</p></body></html>",
    );
    resolveCssStyles($);
    expect($("p").attr("style")).toContain("color: green");
  });

  it("silently skips a selector cheerio cannot parse and still applies the next rule", () => {
    // `p[` passes the pseudo-class filter (no `:` / `@`) but makes cheerio's
    // matcher throw — the try/catch must swallow it. The following valid `p`
    // rule must still resolve onto the element.
    const $ = load(
      "<html><head><style>p[ { color: blue; } p { color: red; }</style></head><body><p>hi</p></body></html>",
    );
    resolveCssStyles($);
    const style = $("p").attr("style") ?? "";
    expect(style).toBe("color: red");
    expect(style).not.toContain("blue");
    expect($("style").length).toBe(0);
  });

  it("does not crash and applies no style when every selector is unparseable", () => {
    const $ = load(
      "<html><head><style>p[ { color: blue; } span[[ { color: green; }</style></head><body><p>hi</p></body></html>",
    );
    resolveCssStyles($);
    expect($("p").attr("style")).toBeUndefined();
    expect($("style").length).toBe(0);
  });
});
