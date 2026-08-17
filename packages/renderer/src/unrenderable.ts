import type { Block } from "@templatical/types";

/**
 * Prefix every unrenderable-block marker carries. Stable and greppable on
 * purpose: it is what a consumer searches for after noticing a gap in a rendered
 * email, and what a send pipeline can scan for before shipping.
 */
export const UNRENDERABLE_MARKER_PREFIX = "templatical:unrenderable-block";

/**
 * Strip anything that would terminate or nest an HTML comment. `-->` inside the
 * marker would close it early and leak the rest as body text; a lone `--` is
 * enough to make the comment non-conforming, so both collapse.
 */
function commentSafe(value: string): string {
  return value.replace(/-{2,}/g, "-").replace(/[<>]/g, "");
}

/**
 * Emit the placeholder for a block no renderer can handle — no built-in renderer
 * and no `blockRenderers` override for its type.
 *
 * **A marker, not a throw and not silence.** The renderer runs inside send
 * pipelines, so killing an entire render over one block is worse than shipping a
 * marked gap. Silence is worse still: a block that simply vanishes reaches
 * recipients as a missing section with nothing anywhere explaining why. The rule
 * is general rather than countdown-specific, so
 * a block type added to `@templatical/types` before its renderer lands degrades
 * the same way.
 *
 * `mj-raw` is used because it is the one element that passes its content through
 * verbatim and is valid everywhere a block renders — inside `mj-column`, which is
 * where every non-section block ends up.
 */
export function renderUnrenderableBlock(block: Block): string {
  console.warn(
    `[Templatical] No renderer for block type "${block.type}" (id: ${block.id}). ` +
      "A placeholder comment was emitted in its place. Pass a `blockRenderers` " +
      "entry for this type to render it.",
  );

  const type = commentSafe(block.type);
  const id = commentSafe(block.id);

  return `<mj-raw><!-- ${UNRENDERABLE_MARKER_PREFIX} type="${type}" id="${id}" --></mj-raw>`;
}
