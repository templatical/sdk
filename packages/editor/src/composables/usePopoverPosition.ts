import { usePopoverRoot } from "./usePopoverRoot";

/**
 * Coordinate helper for popovers that teleport into the shared popover root
 * (`.tpl-popover-root`, `position: relative`) and position themselves with
 * `position: absolute`.
 *
 * Callers compute a target point in **viewport** space — from
 * `getBoundingClientRect()`, `useElementBounding`, or a TipTap caret rect —
 * and `toLocal` converts it to coordinates **local to the popover root** by
 * subtracting the root's own viewport rect.
 *
 * Why this exists: a `position: fixed` popover resolves its coordinates
 * against the nearest ancestor that establishes a containing block — and any
 * `transform` / `filter` / `will-change` on an ancestor of the editor (a
 * consumer's scroll-parallax wrapper, route-transition, reveal animation…)
 * does exactly that, even while its computed `transform` reads `none` (a
 * running/animated transform still promotes the element). The fixed popover
 * would then be offset by that ancestor's position. Anchoring `absolute`
 * inside the (positioned) popover root instead makes the placement immune:
 * both points are read in viewport space, so the subtraction cancels the
 * ancestor offset, and the popover tracks the editor if the ancestor moves.
 *
 * Read `toLocal` inside a `computed` for a reactive result (recomputes with
 * its viewport-coordinate dependencies), or call it once when a popover opens.
 * Falls back to the viewport coordinates unchanged when no popover root is in
 * scope (isolated component tests / headless callers).
 *
 * Internal — not exported from the package entry.
 */
export function usePopoverPosition(): {
  toLocal: (viewport: { top: number; left: number }) => {
    top: number;
    left: number;
  };
} {
  const popoverRoot = usePopoverRoot();
  function toLocal(viewport: { top: number; left: number }): {
    top: number;
    left: number;
  } {
    const rect = popoverRoot.value?.getBoundingClientRect();
    if (!rect) return { top: viewport.top, left: viewport.left };
    return { top: viewport.top - rect.top, left: viewport.left - rect.left };
  }
  return { toLocal };
}
