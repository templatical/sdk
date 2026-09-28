import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripStylesheetImports } from "../src/utils/stripStylesheetImports";

/**
 * A constructed stylesheet drops every `@import` and logs "@import rules are
 * not allowed here" on the host page, so the shadow mount strips them first.
 * The cases below are the forms that reach it: the build's minified output,
 * the editor's own source (the dev path), and whatever the dev style mirror
 * copies out of `document.head`.
 */
describe("stripStylesheetImports", () => {
  it("strips the minified form the build emits", () => {
    expect(
      stripStylesheetImports(
        '@import"https://fonts.bunny.net/css?family=geist:400,500,600";.tpl{color:red}',
      ),
    ).toBe(".tpl{color:red}");
  });

  it("strips every url() form", () => {
    expect(
      stripStylesheetImports(
        [
          "@import url('https://a.test/single.css');",
          '@import url("https://a.test/double.css");',
          "@import url(https://a.test/bare.css);",
          "@import url( 'https://a.test/spaced.css' );",
          "a{b:c}",
        ].join("\n"),
      ),
    ).toBe("\n\n\n\na{b:c}");
  });

  // Without the quote-aware alternatives the match ends at the first `;`
  // inside the URL and leaves `500&display=swap");` in the CSS.
  it("keeps a ; inside a quoted URL within the rule", () => {
    expect(
      stripStylesheetImports(
        '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap");a{b:c}',
      ),
    ).toBe("a{b:c}");
    expect(
      stripStylesheetImports(
        "@import 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500';a{b:c}",
      ),
    ).toBe("a{b:c}");
  });

  it("strips a rule's layer, supports and media conditions with it", () => {
    expect(
      stripStylesheetImports(
        "@import 'tailwindcss/theme.css' layer(theme) theme(inline) prefix(tpl);" +
          '@import "print.css" print;' +
          "@import url(grid.css) supports(display: grid) screen and (min-width: 100px);" +
          "a{b:c}",
      ),
    ).toBe("a{b:c}");
  });

  it("keeps the rules between imports, in order", () => {
    expect(
      stripStylesheetImports(
        '@import "a.css";.one{x:1}@import "b.css";.two{x:2}',
      ),
    ).toBe(".one{x:1}.two{x:2}");
  });

  it("leaves CSS without an import untouched, other at-rules included", () => {
    const css =
      "@media (min-width: 1px){a{b:c}}@font-face{font-family:X;src:url(x.woff2)}@layer base{p{m:0}}";
    expect(stripStylesheetImports(css)).toBe(css);
  });

  it("strips every import the editor's own stylesheet declares, and nothing else", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/styles/index.css"),
      "utf8",
    );
    const importLines = source
      .split("\n")
      .filter((line) => line.startsWith("@import"));
    // The Geist font plus Tailwind's theme and utilities layers.
    expect(importLines).toHaveLength(3);

    const stripped = stripStylesheetImports(source);
    expect(
      stripped.split("\n").filter((line) => line.startsWith("@import")),
    ).toEqual([]);
    expect(stripped).toBe(
      importLines.reduce((css, line) => css.replace(line, ""), source),
    );
  });
});
