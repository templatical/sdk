import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs helper, no types
import * as sheet from "../scripts/shadow-sheet-lib.mjs";

/**
 * `verify:shadow-sheet` runs in CI after the playground build and fails when
 * the playground's own CSS reaches the editor's shadow-root stylesheet. These
 * tests keep its matchers honest: they must catch Tailwind's real preflight
 * and pass the editor's own CSS, whose Tailwind fallbacks share a selector
 * with preflight's box reset.
 */

const require = createRequire(import.meta.url);

describe("shadow sheet host-rule check", () => {
  it("flags Tailwind's own preflight source", () => {
    const preflight = readFileSync(
      require.resolve("tailwindcss/preflight.css"),
      "utf8",
    );

    expect(sheet.findHostRules(preflight)).toEqual([
      "preflight heading reset (titles render at 400)",
      "preflight list reset (lists lose their markers)",
      "preflight box reset (border-box and zero margins everywhere)",
    ]);
  });

  it("flags preflight in the minified form the build emits", () => {
    // Copied from the playground build that leaked it.
    const minified =
      "@layer base{*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}ol,ul,menu{list-style:none}}";

    expect(sheet.findHostRules(minified)).toHaveLength(3);
  });

  it("flags the playground's own class selectors", () => {
    expect(sheet.findHostRules(".pg-note{color:red}")).toEqual([
      "playground class selector (.pg-*)",
    ]);
  });

  it("passes the editor's own CSS, Tailwind property fallbacks included", () => {
    const editorCss =
      "@layer properties{@supports (((-webkit-hyphens:none))){*,:before,:after,::backdrop{--tpl-tw-border-style:solid}}}" +
      ".tpl-text-content p,.tpl-text-editable .tiptap p{margin:0 0 var(--tpl-doc-paragraph-spacing,8px)}" +
      ".tpl-text-content ul,.tpl-text-content ol{margin:8px 0;padding-inline-start:24px}" +
      ":where(.tpl) button{padding:0;margin:0;border:none}";

    expect(sheet.findHostRules(editorCss)).toEqual([]);
    expect(editorCss).toContain(sheet.EDITOR_CSS_MARKER);
  });
});
