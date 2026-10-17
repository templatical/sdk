import type { AppliedHero, SpacingValue } from "@templatical/types";

/** The sizing attributes of an `mj-hero`. */
export interface HeroGeometry {
  mode: "fixed-height";
  /** Total height in px, padding included. */
  height: number;
  backgroundWidth: number;
  backgroundHeight: number;
}

/**
 * The `mj-hero` sizing for a hero in a box `boxWidth` px wide. Every hero's
 * mode, height and image size come from here, so an Outlook rendering
 * finding changes this function and nothing else.
 *
 * Every hero is `fixed-height`: classic Outlook on Windows ignores
 * `fluid-height` (its spacer cells carry `mso-padding-bottom-alt:0`) and
 * shrinks the box to its content, showing only the top of the image.
 *
 * - `height: "image"` → the image's own height at the box width, so the box
 *   matches the image on desktop. A phone keeps that height and crops the
 *   image's sides to cover the narrower box.
 * - a number → that height.
 *
 * Either is at least the top and bottom `padding`, each a whole pixel as MJML
 * reads it: MJML sizes the cell as the height less that padding and would
 * write a negative height for a shorter box.
 *
 * Outlook draws the image as a `v:image` of exactly `backgroundWidth ×
 * backgroundHeight` px from the box's top, clipped to the box, so the width is
 * always the box's and the height is the image's own at that width. An image
 * with no known size takes the fixed box's height, which fills the box and
 * stretches the image to it.
 */
export function heroGeometry(
  hero: AppliedHero,
  boxWidth: number,
  padding: SpacingValue,
): HeroGeometry {
  const backgroundWidth = Math.max(1, Math.round(boxWidth));
  const imageHeight =
    hero.aspectRatio === null
      ? null
      : Math.max(1, Math.round(backgroundWidth * hero.aspectRatio));

  // resolveHero applies "image" only with a known ratio.
  const wanted =
    hero.height === "image" ? (imageHeight ?? backgroundWidth) : hero.height;
  const height = Math.max(
    wanted,
    Math.trunc(padding.top) + Math.trunc(padding.bottom),
  );

  return {
    mode: "fixed-height",
    height,
    backgroundWidth,
    backgroundHeight: imageHeight ?? height,
  };
}
