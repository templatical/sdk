import { nextTick } from "vue";
import { useEditorRoot } from "./useEditorRoot";

/**
 * Returns a function that brings a block into view on the canvas.
 *
 * Selecting a block is not by itself visible: on a long template the selected
 * block can sit far below the fold while the canvas stays exactly where it was,
 * so an insert or a jump reads as "nothing happened". This is what makes the
 * outcome visible at the user's position.
 *
 * Queries through `useEditorRoot()` rather than `document` — in the default
 * shadow-DOM mount the blocks live in the shadow tree, where a document-level
 * query matches nothing.
 *
 * Scrolling is deferred one tick so a block inserted in the same call has
 * rendered by the time it is looked up. `block: "nearest"` leaves an
 * already-visible block alone instead of yanking it to the top.
 */
export function useScrollToBlock(): (blockId: string) => void {
  const root = useEditorRoot();

  return (blockId: string) => {
    void nextTick(() => {
      const target = root.querySelector(`[data-block-id="${blockId}"]`);
      if (!target) return;
      target.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  };
}

function prefersReducedMotion(): boolean {
  // Absent in some embedding contexts; a throw here would break the insert
  // that asked for the scroll, so treat "can't tell" as motion allowed.
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
