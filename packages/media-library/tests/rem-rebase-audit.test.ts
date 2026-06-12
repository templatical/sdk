import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the issue #209 fix for the standalone media library: its Tailwind
 * length scale is rebased off a fixed-px `--tpl-base-size` instead of `rem`, so
 * the media SDK is immune to the host page's `html { font-size }`. `rem` always
 * resolves against the document root — even inside a shadow root.
 *
 * Locks two opposite regressions (see the editor's rem-rebase-audit for the
 * detailed rationale):
 *   1. A raw `rem` reappears in a `.tpl:` utility (a token override is missing
 *      or was dropped) — add a calc(<ratio> * var(--tpl-base-size)) override to
 *      @theme inline in src/styles/index.css.
 *   2. The base default is switched back to a rem value — it MUST stay px, or
 *      the bug returns hidden inside var(--tpl-base-size) while check #1 passes.
 *
 * Runs against the built CSS. Requires `pnpm run build` first; in CI the test
 * job runs after build.
 */

const STYLE_CSS = join(
  import.meta.dirname,
  "..",
  "dist",
  "templatical-media-library.css",
);

function tplUtilityRules(css: string): string[] {
  return css.match(/\.tpl\\:[^{]+\{[^}]*\}/g) ?? [];
}

describe("media-library rem-rebase audit (issue #209)", () => {
  let css: string;

  beforeAll(() => {
    if (!existsSync(STYLE_CSS)) {
      throw new Error(
        `dist CSS not found. Run \`pnpm --filter @templatical/media-library run build\` before this test.`,
      );
    }
    css = readFileSync(STYLE_CSS, "utf8");
  });

  it("defines --tpl-base-size on .tpl with a px default (never rem)", () => {
    const match = css.match(
      /--tpl-base-size:\s*var\(--tpl-user-base-size,\s*(\d+(?:\.\d+)?)(px|rem)\)/,
    );
    expect(match, "--tpl-base-size declaration not found in compiled CSS").not.toBeNull();
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

  it("rebases representative spacing / text / radius utilities onto --tpl-base-size", () => {
    const expectVarBased = (selector: string) => {
      const rule = tplUtilityRules(css).find((r) => r.startsWith(selector + "{"));
      expect(rule, `utility ${selector} not found in compiled CSS`).toBeDefined();
      expect(rule).toContain("var(--tpl-base-size)");
    };
    expectVarBased(".tpl\\:p-4");
    expectVarBased(".tpl\\:text-sm");
    expectVarBased(".tpl\\:rounded");
  });
});
