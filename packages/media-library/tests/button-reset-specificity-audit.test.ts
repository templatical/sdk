import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Audits this package's `.tpl` form-element reset (`src/styles/index.css`),
 * which must stay in lockstep with the editor's reset
 * (`packages/editor/src/styles/index.css`). The two packages share the `.tpl`
 * SDK class and `@templatical/editor` bundles these styles (CDN build + any
 * consumer bundling both from source), so a divergence here regresses the
 * editor.
 *
 * Reads source (not dist) so it locks the authoring decisions directly and does
 * not depend on the build preserving `:where()`.
 */

const INDEX_CSS = join(import.meta.dirname, "..", "src", "styles", "index.css");

// Strip CSS comments so prose mentioning selectors (e.g. the rationale above
// the reset) can't trip the checks below.
const css = readFileSync(INDEX_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The base `:where(.tpl) button { … }` rule (NOT the `:focus-visible` one). */
function baseButtonRule(): string | undefined {
  return css.match(/:where\(\.tpl\)\s+button\s*\{[^}]*\}/)?.[0];
}

/** The reset rule that carries `font-family: inherit` (the form-control group). */
function formControlGroupRule(): string | undefined {
  return css
    .match(/:where\(\.tpl\)[^{]*\{[^}]*\}/g)
    ?.find((rule) => /font-family:\s*inherit/.test(rule));
}

describe("media-library button reset specificity audit (issue #357)", () => {
  it("scopes the button appearance reset with :where() (zero specificity)", () => {
    const rule = baseButtonRule();
    expect(
      rule,
      "no `:where(.tpl) button { … }` reset found in src/styles/index.css",
    ).toBeDefined();
    expect(rule).toContain("background: none");
    expect(rule).toContain("border: none");
  });

  it("never authors a bare `.tpl button` reset (0,1,1 out-specifies utilities — #357)", () => {
    // `\.tpl\s+button` matches a bare `.tpl button` selector but NOT
    // `:where(.tpl) button` (there `.tpl` is followed by `)`, not whitespace)
    // and NOT `.tpl-*` classes (followed by `-`, not whitespace).
    const bare = css.match(/\.tpl\s+button/);
    expect(
      bare,
      `Found a bare \`.tpl button\` selector (specificity 0,1,1) in ` +
        `src/styles/index.css. It out-specifies single-class button utilities ` +
        `(e.g. \`.tpl:bg-[var(--tpl-primary)]\`, 0,1,0) and reintroduces the ` +
        `invisible-primary-button regression (#357). Scope it with ` +
        `\`:where(.tpl) button\` instead.\n` +
        `Match: ${bare?.[0]}`,
    ).toBeNull();
  });
});

describe("media-library reset parity with the editor", () => {
  it("sets box-sizing: border-box on the form-control reset (issue #115)", () => {
    // Preflight is omitted, so without this a padded `tpl:w-full` input
    // resolves to width:100% + padding and overflows its parent (#115).
    const rule = formControlGroupRule();
    expect(
      rule,
      "no `:where(.tpl) …` reset carrying `font-family: inherit` found",
    ).toBeDefined();
    expect(rule).toContain("box-sizing: border-box");
  });

  it("keeps outline off the base button rule and moves it to :focus-visible with a ring (a11y)", () => {
    // An unconditional `outline: none` on `.tpl button` removes the keyboard
    // focus ring entirely. The reset must only drop the outline for
    // `:focus-visible`, replacing it with the `--tpl-ring` box-shadow.
    const base = baseButtonRule();
    expect(base, "base `:where(.tpl) button` rule not found").toBeDefined();
    expect(
      /outline/.test(base!),
      `Base \`:where(.tpl) button\` rule sets \`outline\` unconditionally — ` +
        `that kills the keyboard focus ring. Move it to a \`:focus-visible\` ` +
        `rule instead.\nRule: ${base}`,
    ).toBe(false);

    const focusRule = css.match(
      /:where\(\.tpl\)\s+button:focus-visible[^{]*\{[^}]*\}/,
    )?.[0];
    expect(
      focusRule,
      "no `:where(.tpl) button:focus-visible { … }` focus-ring rule found",
    ).toBeDefined();
    expect(focusRule).toContain("outline: none");
    expect(focusRule).toContain("box-shadow: var(--tpl-ring)");
  });
});
