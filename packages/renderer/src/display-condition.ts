import type { Block } from "@templatical/types";

/**
 * Wrap rendered block markup in the block's liquid display-condition guards
 * (`<mj-raw>{% if %}</mj-raw>` … `<mj-raw>{% endif %}</mj-raw>`), if present.
 *
 * Returns the input unchanged when the block has no display condition, and an
 * empty string when the rendered markup is empty (a hidden block) so callers
 * can keep using an `=== ""` filter to drop it.
 *
 * Used for BOTH top-level blocks (`index.ts`) and blocks nested inside section
 * columns (`renderers/section.ts`). A condition on a nested block must emit the
 * same guards as a top-level one — otherwise conditional content placed inside
 * a multi-column section renders unconditionally for every recipient.
 */
export function wrapWithDisplayCondition(
  block: Block,
  rendered: string,
): string {
  if (rendered === "") {
    return "";
  }

  const displayCondition = block.displayCondition;

  if (!displayCondition) {
    return rendered;
  }

  return (
    `<mj-raw>${displayCondition.before}</mj-raw>` +
    "\n" +
    rendered +
    "\n" +
    `<mj-raw>${displayCondition.after}</mj-raw>`
  );
}
