/**
 * Ambient declarations for editor-local virtual modules. Loaded via the
 * triple-slash reference at the top of `index.ts` so the declaration is
 * visible to any consumer typechecking through the workspace path alias
 * (playground, e2e fixtures, etc.) without needing each consumer's tsconfig
 * to include this file explicitly.
 */

declare module "virtual:editor-css" {
  /**
   * The editor's fully-bundled library CSS as a string — Tailwind utilities,
   * every SFC `<style>` block, and `styles/index.css` rules. Injected at
   * build time by `scripts/inline-style-css-plugin.ts`. In dev/test, returns
   * the raw `styles/index.css` source.
   *
   * Used to populate `adoptedStyleSheets` on shadow roots in
   * `shadowDom: true` mode.
   */
  const css: string;
  export default css;

  /**
   * The directories whose CSS is the editor's, as `/`-separated prefixes with
   * a trailing slash, or `null` when the build that compiles the editor set
   * none (the editor's own builds). Set from the plugin's `ownedRoots` by a
   * host app that compiles the editor from source; the dev style mirror uses
   * it to keep the host's styles out of the shadow root.
   */
  export const ownedStyleRoots: readonly string[] | null;
}
