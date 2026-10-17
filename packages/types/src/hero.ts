import {
  resolveBackgroundImage,
  type BackgroundImage,
  type ResolvedBackgroundImage,
} from "./background-image";

/** Where a hero's content sits in its box. */
export type HeroVerticalAlign = "top" | "middle" | "bottom";

export const HERO_VERTICAL_ALIGNS: readonly HeroVerticalAlign[] = [
  "top",
  "middle",
  "bottom",
];

/**
 * Draws a one-column section as an MJML `mj-hero`: its background image
 * fills the box (always `cover`, never tiled) and the content sits on top of
 * it. A hero applies only to a one-column section with a background image;
 * otherwise the section renders as a regular one.
 */
export interface SectionHero {
  /**
   * `"image"` keeps the box at the image's aspect ratio at every width, and
   * needs the image's size on `backgroundImage.naturalWidth` /
   * `naturalHeight`. A number is the box's fixed height in px, padding
   * included.
   */
  height: "image" | number;
  verticalAlign: HeroVerticalAlign;
}

/** Why a section with `hero` set renders as a regular section. */
export type HeroNotAppliedReason = "columns" | "image" | "size";

/** A hero that renders, resolved to the values the renderer and canvas use. */
export interface AppliedHero {
  applied: true;
  /** The section's background image, as `resolveBackgroundImage` resolves it. */
  image: ResolvedBackgroundImage;
  /** A fixed height in px (rounded), or `"image"`. */
  height: "image" | number;
  verticalAlign: HeroVerticalAlign;
  /**
   * The image's height ÷ width; `null` when its size is unknown, which only
   * a fixed height allows.
   */
  aspectRatio: number | null;
}

export type ResolvedHero =
  AppliedHero | { applied: false; reason: HeroNotAppliedReason };

/** The section fields hero mode reads. */
export interface HeroCandidate {
  columns: string;
  hero?: SectionHero;
  backgroundImage?: BackgroundImage;
}

/**
 * Whether a section renders as a hero, and with what; `null` when `hero` is
 * unset. The renderer, the quality linter and the editor all decide through
 * this, so the email, the warning and the canvas agree. Checked in order:
 * one column, a usable background image, then — for `height: "image"` — the
 * image's size. Values from tampered JSON fall back instead of reaching MJML:
 * a height that isn't a finite number of at least 1 reads as `"image"`, an
 * unknown `verticalAlign` as `"middle"`.
 */
export function resolveHero(section: HeroCandidate): ResolvedHero | null {
  const hero = section.hero;
  if (!hero || typeof hero !== "object") return null;
  if (section.columns !== "1") return { applied: false, reason: "columns" };

  const image = resolveBackgroundImage(section.backgroundImage);
  if (image === null) return { applied: false, reason: "image" };

  const aspectRatio = imageAspectRatio(section.backgroundImage);
  const height = isFixedHeight(hero.height) ? Math.round(hero.height) : "image";
  if (height === "image" && aspectRatio === null) {
    return { applied: false, reason: "size" };
  }

  const verticalAlign = HERO_VERTICAL_ALIGNS.includes(hero.verticalAlign)
    ? hero.verticalAlign
    : "middle";
  return { applied: true, image, height, verticalAlign, aspectRatio };
}

function isFixedHeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

/**
 * A background image's height ÷ width, or `null` unless both are positive,
 * finite numbers.
 */
export function imageAspectRatio(
  bg: BackgroundImage | undefined,
): number | null {
  const width = bg?.naturalWidth;
  const height = bg?.naturalHeight;
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return height / width;
}
