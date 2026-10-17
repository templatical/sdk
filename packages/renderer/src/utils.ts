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

import type {
  BackgroundImage,
  BorderRadiusValue,
  BorderValue,
  ImageBlock,
  SpacingValue,
} from "@templatical/types";
import {
  resolveBackgroundImage,
  toBorderCss,
  toBorderDeclarations,
  toBorderRadiusCss,
} from "@templatical/types";
import { escapeAttr, escapeCssValue } from "./escape";
import type { RenderContext } from "./render-context";

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

/**
 * Render `mj-image`'s height attribute. Returns an empty string when no height
 * is set, so MJML applies its own `auto` and the image keeps its aspect ratio.
 *
 * The px suffix is not cosmetic: `height` is a Unit attribute accepting only
 * `px` or `auto`, so a bare number is a validation error and MJML drops it.
 * Non-finite or non-positive values are treated as unset — a `0` here would
 * collapse the image rather than express "no opinion".
 */
export function heightAttr(height: number | undefined): string {
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
    return "";
  }

  return ` height="${height}px"`;
}

/**
 * The width an element's side padding and drawn side borders take from its
 * box. MJML subtracts exactly these when it sizes a wrapper's, a section's or
 * an image's content, so a side `toBorderCss` would not draw counts for 0.
 * MJML reads each side as a whole pixel (`parseInt` in its `shorthandParser`
 * and `borderParser`), so 20.5px of padding takes 20px and a 2.5px border 2px.
 */
export function horizontalInset(
  padding: SpacingValue | undefined,
  border?: BorderValue,
): number {
  const whole = (value: number | undefined) => Math.trunc(value ?? 0);
  const drawn = (side: BorderValue["left"] | undefined) =>
    toBorderCss(side) === null ? 0 : Math.trunc(side!.width);
  return (
    whole(padding?.left) +
    whole(padding?.right) +
    drawn(border?.left) +
    drawn(border?.right)
  );
}

/**
 * `fluid-on-mobile` for an `mj-image`, set only on an image that fills its
 * column on desktop: `"full"`, or a pixel width MJML caps at the room it gives
 * the image (the column less the image's own side padding and border). On a
 * phone the attribute widens the image to the stacked column, so an image set
 * narrower must not carry it: a 120px logo would grow to the whole column, and
 * one with a set height would stretch out of shape. An image wider than the
 * phone shrinks to fit without it.
 *
 * Exported for `blockRenderers` entries that emit their own `mj-image`. Pass
 * the context the renderer received, whose `contentWidth` already excludes the
 * wrappers and sections around the column.
 */
export function fluidOnMobileAttr(
  block: Pick<ImageBlock, "width" | "styles" | "border">,
  context: RenderContext,
): string {
  const room =
    Math.floor(context.contentWidth) -
    horizontalInset(block.styles.padding, block.border);
  return block.width === "full" || block.width >= room
    ? ' fluid-on-mobile="true"'
    : "";
}

/**
 * Render the border attributes for the MJML elements that accept them natively
 * (`mj-section`, `mj-image`, `mj-button`): a single `border` when it covers all
 * four sides, otherwise one `border-<side>` per chosen side. Returns an empty
 * string when there is nothing to draw, so templates without a border render
 * exactly as before.
 *
 * MJML copies the values into an inline `style`, so they go through
 * `escapeCssValue` — a tampered color must not smuggle in a sibling
 * declaration.
 */
export function borderAttr(border: BorderValue | undefined): string {
  return Object.entries(toBorderDeclarations(border))
    .map(([name, value]) => ` ${name}="${escapeCssValue(value)}"`)
    .join("");
}

/**
 * Render the `border-radius` attribute: `"8px"` for matching corners, or the
 * four-value shorthand (top-left, top-right, bottom-right, bottom-left) that
 * `mj-section`, `mj-wrapper`, `mj-image` and `mj-button` all accept. Returns an
 * empty string when every corner is square, rather than a `border-radius="0px"`
 * every existing template would suddenly grow.
 */
export function borderRadiusAttr(
  radius: BorderRadiusValue | undefined,
): string {
  const css = toBorderRadiusCss(radius);

  if (css === null) {
    return "";
  }

  return ` border-radius="${css}"`;
}

/**
 * Render the background-image attributes `mj-section` and `mj-wrapper` accept.
 * All four are emitted together, so MJML's own defaults (`auto`, `top center`,
 * `repeat`) never apply. Returns an empty string when there is no image.
 *
 * MJML pastes `background-url` verbatim into `url('…')` and the Outlook VML
 * `src`; `resolveBackgroundImage` has already percent-encoded the characters
 * that could end the CSS string, and `escapeAttr` keeps the attribute closed.
 */
export function backgroundImageAttrs(bg: BackgroundImage | undefined): string {
  const resolved = resolveBackgroundImage(bg);

  if (resolved === null) {
    return "";
  }

  return ` background-url="${escapeAttr(resolved.url)}" background-size="${resolved.size}" background-position="${resolved.position}" background-repeat="${resolved.repeat}"`;
}
