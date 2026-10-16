import type { AppliedHero } from "@templatical/types";

/** The sizing attributes of an `mj-hero`. */
export interface HeroGeometry {
  mode: "fluid-height" | "fixed-height";
  /** Total height in px, padding included; set for `fixed-height` only. */
  height?: number;
  backgroundWidth: number;
  backgroundHeight: number;
}

/**
 * The `mj-hero` sizing for a hero in a box `boxWidth` px wide. Every hero's
 * mode, height and image size come from here, so an Outlook rendering
 * finding changes this function and nothing else.
 *
 * - `height: "image"` → `fluid-height`: MJML keeps the box at
 *   `backgroundHeight / backgroundWidth` with `padding-bottom` spacers at
 *   every width.
 * - a number → `fixed-height` at that height.
 *
 * Outlook on Windows ignores both and draws the image as a `v:image` of
 * exactly `backgroundWidth × backgroundHeight` px, so the width is always the
 * box's and the height is the image's own at that width. An image with no
 * known size takes the fixed box's height, filling the box.
 */
export function heroGeometry(
  hero: AppliedHero,
  boxWidth: number,
): HeroGeometry {
  const backgroundWidth = Math.max(1, Math.round(boxWidth));
  const imageHeight =
    hero.aspectRatio === null
      ? null
      : Math.max(1, Math.round(backgroundWidth * hero.aspectRatio));

  if (hero.height === "image") {
    // resolveHero applies "image" only with a known ratio.
    return {
      mode: "fluid-height",
      backgroundWidth,
      backgroundHeight: imageHeight ?? backgroundWidth,
    };
  }

  return {
    mode: "fixed-height",
    height: hero.height,
    backgroundWidth,
    backgroundHeight: imageHeight ?? hero.height,
  };
}
