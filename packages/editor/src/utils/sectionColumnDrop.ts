/**
 * Drop-guard for a section column's VueDraggable `put` predicate.
 *
 * MJML forbids `<mj-section>` inside `<mj-column>`, so a section nested in a
 * column is silently dropped from the exported MJML (issue #292). The editor
 * must reject a section being dropped into a column up front.
 *
 * A dragged element identifies its block type differently depending on source:
 * canvas blocks carry `data-block-type` (set by `BlockWrapper`), palette items
 * carry `data-palette-type` (set by `Sidebar`). The guard must check BOTH —
 * checking only `data-block-type` lets a section dragged from the palette slip
 * through, which was the exact hole behind #292.
 */
export function canDropInSectionColumn(el: HTMLElement): boolean {
  return (
    el.dataset.blockType !== "section" && el.dataset.paletteType !== "section"
  );
}
