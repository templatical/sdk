/**
 * Virtual modules owned by editor-local Vite plugins.
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
}
