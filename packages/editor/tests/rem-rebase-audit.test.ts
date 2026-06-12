import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the issue #209 fix: the editor's Tailwind length scale is rebased off
 * a fixed-px `--tpl-base-size` instead of `rem`, so the editor is immune to the
 * host page's `html { font-size }`. `rem` always resolves against the document
 * root — even inside a shadow root — so a consumer's `html { font-size: 8px }`
 * would otherwise render the whole editor at half size.
 *
 * Two regressions are locked here, and they catch opposite failure modes:
 *
 *   1. A raw `rem` reappears in a `.tpl:`-prefixed utility — e.g. a new utility
 *      (`text-2xl`, `rounded-2xl`, a new `--container-*`) whose token wasn't
 *      added to the `@theme inline` override block in `src/styles/index.css`,
 *      or one of the existing overrides is dropped. Fix: add/restore the
 *      matching `--<token>: calc(<ratio> * var(--tpl-base-size))` override.
 *
 *   2. The base unit's default is switched back to a `rem` value. That would
 *      hide the `rem` inside `var(--tpl-base-size)` — so check #1 would still
 *      pass while the bug silently returns. The default MUST be a px length.
 *
 * Runs against the built `dist/style.css`. Requires `pnpm run build` first; in
 * CI the test job runs after build (see .github/workflows/ci.yml). The CDN
 * bundle (`dist/cdn/editor.css`) compiles from the same `src/styles/index.css`,
 * so this npm-CSS check covers it too.
 */

const STYLE_CSS = join(import.meta.dirname, "..", "dist", "style.css");

/** Every compiled `.tpl\:<util>{…}` rule block in the stylesheet. */
function tplUtilityRules(css: string): string[] {
  // Minified output: `.tpl\:p-4{padding:calc(...)}`. The colon is
  // backslash-escaped in the selector, hence `\\:` in the pattern.
  return css.match(/\.tpl\\:[^{]+\{[^}]*\}/g) ?? [];
}

describe("editor rem-rebase audit (issue #209)", () => {
  let css: string;

  beforeAll(() => {
    if (!existsSync(STYLE_CSS)) {
      throw new Error(
        `dist/style.css not found. Run \`pnpm --filter @templatical/editor run build\` before this test.`,
      );
    }
    css = readFileSync(STYLE_CSS, "utf8");
  });

  it("defines --tpl-base-size on .tpl with a px default (never rem)", () => {
    const match = css.match(
      /--tpl-base-size:\s*var\(--tpl-user-base-size,\s*(\d+(?:\.\d+)?)(px|rem)\)/,
    );
    expect(match, "--tpl-base-size declaration not found in compiled CSS").not.toBeNull();
    // The fallback unit decides whether the editor is immune to the host root
    // font-size. A `rem` fallback would reintroduce the bug while sneaking past
    // the no-raw-rem check below.
    expect(match![2]).toBe("px");
    expect(Number(match![1])).toBe(16);
  });

  it("emits no .tpl: utility with a raw rem value (all are rebased onto --tpl-base-size)", () => {
    const offenders = tplUtilityRules(css).filter((rule) => /[0-9.]+rem\b/.test(rule));
    expect(
      offenders,
      `Found .tpl: utilities still using raw rem (couples them to the host html ` +
        `font-size). Add a calc(<ratio> * var(--tpl-base-size)) override for each ` +
        `token to @theme inline in src/styles/index.css (issue #209):\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("rebases the representative spacing / text / radius utilities onto --tpl-base-size", () => {
    // Inverse guard: if `theme(inline)` stops carrying the var (e.g. the import
    // mode changes) these would fold back to literals and #2 would still pass
    // only because the literals happen to be px — so assert the var is present.
    const expectVarBased = (selector: string) => {
      const rule = tplUtilityRules(css).find((r) => r.startsWith(selector + "{"));
      expect(rule, `utility ${selector} not found in compiled CSS`).toBeDefined();
      expect(rule).toContain("var(--tpl-base-size)");
    };
    expectVarBased(".tpl\\:p-4");
    expectVarBased(".tpl\\:text-sm");
    expectVarBased(".tpl\\:rounded");
    expectVarBased(".tpl\\:size-8");
  });
});
