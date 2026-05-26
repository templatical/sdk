import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Form-element reset invariants for `styles/index.css`.
 *
 * Tailwind preflight is intentionally disabled (see CLAUDE.md), so the
 * hand-rolled `:where(.tpl) button, input, select, textarea` block is the
 * only source of cross-cutting form defaults. Any change there has a long
 * blast radius — every input/select/textarea in the editor depends on it.
 *
 * Regression locked: issue #115 — `box-sizing: border-box` is required on
 * form elements. Without it, `tpl:w-full` + horizontal padding utilities
 * (e.g. `tpl:px-3.5`) resolve to content-box, and inputs overflow their
 * parent by the padding width. The right sidebar (320px) made this
 * visible; every other sidebar/modal had the same latent bug.
 */

const STYLES = readFileSync(
  join(import.meta.dirname, "..", "src", "styles", "index.css"),
  "utf8",
);

describe("form element reset", () => {
  const resetBlock =
    STYLES.match(
      /:where\(\.tpl\)\s+button,\s*\n\s*:where\(\.tpl\)\s+input,\s*\n\s*:where\(\.tpl\)\s+select,\s*\n\s*:where\(\.tpl\)\s+textarea\s*\{[^}]*\}/,
    )?.[0] ?? "";

  it("the form-element reset block exists and targets all four elements", () => {
    expect(resetBlock).toContain("button");
    expect(resetBlock).toContain("input");
    expect(resetBlock).toContain("select");
    expect(resetBlock).toContain("textarea");
  });

  it("declares `box-sizing: border-box` (issue #115 — prevents w-full + padding overflow)", () => {
    expect(resetBlock).toMatch(/box-sizing:\s*border-box\s*;/);
  });

  it("inherits font-family so form controls match editor typography", () => {
    expect(resetBlock).toMatch(/font-family:\s*inherit\s*;/);
  });
});
