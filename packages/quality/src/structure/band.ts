import type { BackgroundImage, SectionBlock } from "@templatical/types";
import { isWrapper } from "@templatical/types";
import type { WalkContext } from "../types";

/** The `mj-wrapper` a section renders inside, as far as backgrounds go. */
export interface SectionBand {
  backgroundColor?: string;
  backgroundImage?: BackgroundImage;
}

/**
 * The band directly around a section: its own `wrapper` when set, otherwise
 * the layout `wrapper` block it sits in. `null` when nothing frames it.
 */
export function enclosingBand(
  section: SectionBlock,
  ctx: WalkContext,
): SectionBand | null {
  if (section.wrapper) {
    return section.wrapper;
  }

  if (ctx.parent && isWrapper(ctx.parent)) {
    return {
      backgroundColor: ctx.parent.styles?.backgroundColor,
      backgroundImage: ctx.parent.backgroundImage,
    };
  }

  return null;
}

/**
 * A color that actually paints — not unset, empty, `transparent` or a
 * non-string value from hand-edited JSON.
 */
export function isPaintedColor(color: string | undefined): boolean {
  if (typeof color !== "string") return false;
  const value = color.trim().toLowerCase();
  return value !== "" && value !== "transparent";
}
