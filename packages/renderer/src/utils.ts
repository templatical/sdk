/**
 * MJML attribute helpers — single source of truth for placement rules
 * that the MJML spec enforces but accepts silently when violated.
 *
 * MJML drops unrecognized attributes without error. The most common trap is
 * background placement: only `mj-section`, `mj-button`, `mj-wrapper`, `mj-hero`
 * accept the native `background-color` attribute. Inner content elements
 * (`mj-text`, `mj-image`, `mj-table`, `mj-navbar`, `mj-video`) require
 * `container-background-color`, which paints the enclosing `<td>`. Passing
 * `background-color` to an inner element results in the attribute being
 * silently dropped — the email ships without the bg.
 *
 * https://documentation.mjml.io/
 */

/**
 * Where the MJML element accepts a background-color attribute.
 * - `native`: the element has its own `background-color` (mj-section, mj-button).
 * - `container`: the element only accepts `container-background-color`,
 *   which colors the wrapping `<td>` (mj-text, mj-image, mj-table, mj-navbar, mj-video).
 */
export type BgPlacement = "native" | "container";

/**
 * Render the appropriate background-color attribute for an MJML element.
 * Returns an empty string when no color is set, or a leading-space attribute
 * fragment ready to interpolate into a tag's attribute list.
 */
export function bgAttr(
  backgroundColor: string | undefined,
  placement: BgPlacement,
): string {
  if (!backgroundColor) {
    return "";
  }

  const name =
    placement === "native" ? "background-color" : "container-background-color";

  return ` ${name}="${backgroundColor}"`;
}
