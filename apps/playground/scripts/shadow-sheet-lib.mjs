/**
 * Checks for the stylesheet the playground build inlines as
 * `virtual:editor-css`, the sheet every shadow-mounted editor adopts. The
 * playground compiles the editor from source, so its own CSS can end up in
 * that sheet; `ownedRoots` in `vite.config.ts` keeps it out. These checks fail
 * when it gets back in. Used by `verify-shadow-sheet.mjs`.
 */

/**
 * Only the inlined editor stylesheet holds this selector, so it marks the
 * chunk carrying it. Kept in the minified form the build emits.
 */
export const EDITOR_CSS_MARKER = ".tpl-text-editable .tiptap p{";

/**
 * Tailwind preflight rules that change what the canvas renders, matched in
 * minified and source form. The `*` rule needs `box-sizing` so Tailwind's
 * `@layer properties` fallbacks, which share its selector, don't match.
 */
const HOST_RULES = [
  {
    name: "preflight heading reset (titles render at 400)",
    pattern:
      /h1\s*,\s*h2\s*,\s*h3\s*,\s*h4\s*,\s*h5\s*,\s*h6\s*\{[^}]*font-weight:\s*inherit/,
  },
  {
    name: "preflight list reset (lists lose their markers)",
    pattern: /ol\s*,\s*ul\s*,\s*menu\s*\{[^}]*list-style:\s*none/,
  },
  {
    name: "preflight box reset (border-box and zero margins everywhere)",
    pattern:
      /\*\s*,\s*::?(?:after|before)\s*,\s*::?(?:after|before)\s*,\s*::backdrop[^{]*\{[^}]*box-sizing:\s*border-box/,
  },
  {
    name: "playground class selector (.pg-*)",
    pattern: /\.pg-[a-z]/,
  },
];

/** The host rules found in `css`, by name; empty when the sheet is clean. */
export function findHostRules(css) {
  return HOST_RULES.filter(({ pattern }) => pattern.test(css)).map(
    ({ name }) => name,
  );
}
