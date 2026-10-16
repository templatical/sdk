import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The editor chrome resets itself with Tailwind's preflight, scoped.
 *
 * The chrome was designed against preflight: the playground's own build leaked
 * it into the editor's shadow root for months, while npm and CDN installs never
 * had it. Without it the chrome renders with browser defaults: content-box
 * dialog panels overrunning their caps, UA margins on headings and help text,
 * list bullets, buttons in a 13.33px UA font. The reset restores the designed
 * box model and typography, within these limits:
 *
 *   - scoped to `:where(.tpl)`, so it can't reach the host page;
 *   - never inside `.tpl-email-surface`, the subtree that renders the email,
 *     which must keep the cascade email clients have (content-box, UA margins);
 *   - in `@layer base` and wrapped in `:where()`, so every editor utility and
 *     unlayered rule wins over it.
 *
 * `block-chrome-structure.test.ts` locks where `.tpl-email-surface` sits, and
 * `apps/playground/e2e/tests/canvas-editor-css-only.spec.ts` proves at runtime
 * that the reset changes nothing inside it.
 */

const STYLES = readFileSync(
  join(import.meta.dirname, "..", "src", "styles", "index.css"),
  "utf8",
);
const PREFLIGHT = readFileSync(
  createRequire(import.meta.url).resolve("tailwindcss/preflight.css"),
  "utf8",
);

const SCOPE = ":where(.tpl) :where(";
const OUTSIDE_EMAIL = ":not(:where(.tpl-email-surface, .tpl-email-surface *))";

/** The scoped form the reset gives one preflight selector. */
function scoped(selector: string): string {
  if (selector.startsWith("::")) return `${SCOPE}*)${OUTSIDE_EMAIL}${selector}`;
  // Preflight's own `:where()` wrappers become `:is()` inside the outer
  // `:where()`, which already drops the specificity.
  const unwrapped = selector.startsWith(":where(")
    ? selector.replace(/^:where\((.*?)\)(?=\s)/, "$1")
    : selector;
  return `${SCOPE}${unwrapped.replace(/:where\(/g, ":is(")})${OUTSIDE_EMAIL}`;
}

const normalize = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");

/** Every selector of every style rule, comma lists split, comments dropped. */
function selectorsOf(css: string): string[] {
  const out: string[] = [];
  const re = /([^{};]+)\{/g;
  let m: RegExpExecArray | null;
  const clean = normalize(css);
  while ((m = re.exec(clean))) {
    const prelude = m[1].trim();
    if (prelude.startsWith("@")) continue;
    out.push(...prelude.split(/,(?![^(]*\))/).map((s) => s.trim()));
  }
  return out;
}

/** The chrome reset: the `@layer base` block that holds the scoped rules. */
function resetBlock(): string {
  const start = STYLES.indexOf("@layer base {");
  expect(start, "chrome reset `@layer base` block").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = STYLES.indexOf("{", start); i < STYLES.length; i++) {
    if (STYLES[i] === "{") depth++;
    else if (STYLES[i] === "}" && --depth === 0) return STYLES.slice(start, i + 1);
  }
  throw new Error("unterminated @layer base block");
}

describe("scoped chrome reset", () => {
  it("mirrors the Tailwind preflight it was written from", () => {
    // Pinned so a Tailwind bump that changes preflight fails here, and the
    // scoped copy is brought in line on purpose.
    expect(selectorsOf(PREFLIGHT)).toEqual([
      "*", "::after", "::before", "::backdrop", "::file-selector-button",
      "html", ":host",
      "hr",
      "abbr:where([title])",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "a",
      "b", "strong",
      "code", "kbd", "samp", "pre",
      "small",
      "sub", "sup", "sub", "sup",
      "table",
      ":-moz-focusring:where(:not(iframe))",
      "progress",
      "summary",
      "ol", "ul", "menu",
      "img", "svg", "video", "canvas", "audio", "iframe", "embed", "object",
      "img", "video",
      "button", "input", "select", "optgroup", "textarea", "::file-selector-button",
      ":where(select:is([multiple], [size])) optgroup",
      ":where(select:is([multiple], [size])) optgroup option",
      "::file-selector-button",
      "::placeholder",
      "::placeholder",
      "textarea",
      "::-webkit-search-decoration",
      "::-webkit-date-and-time-value",
      "::-webkit-datetime-edit",
      "::-webkit-datetime-edit-fields-wrapper",
      "::-webkit-datetime-edit", "::-webkit-datetime-edit-year-field",
      "::-webkit-datetime-edit-month-field", "::-webkit-datetime-edit-day-field",
      "::-webkit-datetime-edit-hour-field", "::-webkit-datetime-edit-minute-field",
      "::-webkit-datetime-edit-second-field",
      "::-webkit-datetime-edit-millisecond-field",
      "::-webkit-datetime-edit-meridiem-field",
      "::-webkit-calendar-picker-indicator",
      ":-moz-ui-invalid",
      "button", "input:where([type='button'], [type='reset'], [type='submit'])",
      "::file-selector-button",
      "::-webkit-inner-spin-button", "::-webkit-outer-spin-button",
      "[hidden]:where(:not([hidden='until-found']))",
    ]);
  });

  it("scopes every preflight rule except the page-level one", () => {
    const block = normalize(resetBlock());
    const missing = selectorsOf(PREFLIGHT)
      .filter((s) => s !== "html" && s !== ":host")
      .map(scoped)
      .filter((s) => !block.includes(s));
    expect(missing).toEqual([]);
  });

  it("keeps every selector inside the editor and out of the email", () => {
    const selectors = selectorsOf(resetBlock().replace(/^@layer base \{/, ""));
    expect(selectors.length).toBeGreaterThan(50);
    const unscoped = selectors.filter(
      (s) => !s.startsWith(SCOPE) || !s.includes(OUTSIDE_EMAIL),
    );
    expect(unscoped).toEqual([]);
  });

  it("never targets the page itself", () => {
    const selectors = selectorsOf(resetBlock().replace(/^@layer base \{/, ""));
    const pageLevel = selectors.filter((s) =>
      /(^|[\s(,])(html|body|:root|:host)\b/.test(s),
    );
    expect(pageLevel).toEqual([]);
  });

  it("sits in the base layer, below every unlayered editor rule", () => {
    expect(STYLES).toMatch(/@layer theme, base, components;/);
    expect(normalize(resetBlock())).toMatch(/^@layer base \{/);
  });
});
