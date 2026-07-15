import {
  getLogicMergeTagKeyword,
  getMergeTagLabel,
  isLogicMergeTagValue,
  isMergeTagValue,
  type MergeTag,
  type SyntaxPreset,
} from "@templatical/types";

/**
 * Rewrites merge-tag and logic-tag tokens in a plain-string field value to
 * their human-readable labels, for canvas display.
 *
 * This is the plain-text analog of `resolveHtmlMergeTagLabels`, which only
 * rewrites `<span data-merge-tag>` markup produced by the TipTap editor. Blocks
 * that render a merge-tag-enabled text field directly as a string (button
 * label, menu items) have no such markup, so without this the canvas shows the
 * raw `{{shipping_method}}` while the rich-text blocks show "Shipping Method".
 *
 * Data tags resolve via `getMergeTagLabel` (unknown tags fall back to their raw
 * value); logic tags resolve to their keyword (e.g. `IF`). This mirrors the
 * segment resolution used by the sidebar merge-tag field, so the canvas and the
 * field agree.
 */
export function resolveMergeTagLabelsText(
  text: string,
  mergeTags: MergeTag[],
  syntax: SyntaxPreset,
): string {
  if (!text) return text;
  const regex = new RegExp(
    `(${syntax.value.source}|${syntax.logic.source})`,
    "g",
  );
  return text.replace(regex, (match) => {
    if (isMergeTagValue(match, syntax)) {
      return getMergeTagLabel(match, mergeTags);
    }
    if (isLogicMergeTagValue(match, syntax)) {
      return getLogicMergeTagKeyword(match, syntax);
    }
    return match;
  });
}
