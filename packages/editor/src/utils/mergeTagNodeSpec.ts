import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
  type SyntaxPreset,
} from "@templatical/types";

/**
 * TipTap content spec for inserting a merge tag as the correct node type.
 * `mergeTagNode` for data tags (`{{ first_name }}`), `logicMergeTagNode` for
 * logic tags (`{% if vip %}`).
 */
export type MergeTagNodeSpec =
  | { type: "mergeTagNode"; attrs: { label: string; value: string } }
  | { type: "logicMergeTagNode"; attrs: { value: string; keyword: string } };

/**
 * Resolve which node a merge tag value should be inserted as, inferring the
 * kind from the value's shape (there is no explicit type discriminator on
 * `MergeTag`). A logic-shaped value yields a `logicMergeTagNode` carrying the
 * derived keyword; everything else yields a data `mergeTagNode`.
 *
 * This gives the selector / autocomplete insertion paths the same branching
 * that manual typing already gets from each node's input rule, so a logic tag
 * picked from the merge tag selector renders as a logic badge instead of a
 * data tag. `label` is only used by data tags — logic nodes display the
 * keyword extracted from the value.
 *
 * Attrs are constructed from `value`/`label`/derived keyword only, so callers
 * that smuggle extra `MergeTag` fields (group, description) via a wider type
 * cannot leak them into the document JSON.
 */
export function mergeTagNodeSpec(
  value: string,
  label: string,
  syntax: SyntaxPreset,
): MergeTagNodeSpec {
  if (isLogicMergeTagValue(value, syntax)) {
    return {
      type: "logicMergeTagNode",
      attrs: { value, keyword: getLogicMergeTagKeyword(value, syntax) },
    };
  }
  return { type: "mergeTagNode", attrs: { label, value } };
}
