import { SYNTAX_PRESETS } from "@templatical/types";
import { inject } from "vue";
import { MERGE_TAGS_KEY, MERGE_TAG_SYNTAX_KEY } from "../keys";
import { resolveMergeTagLabelsText } from "../utils/resolveMergeTagLabelsText";

/**
 * Returns a function that rewrites merge-tag tokens in a plain-string field
 * value to their human-readable labels for canvas display — the plain-text
 * analog of `useEditableTextBlock`'s HTML resolution, used by blocks that
 * render a merge-tag-enabled text field directly (button label, menu items).
 *
 * Injects the configured tags + syntax once and closes over them, so callers
 * just pass the raw string. Falls back to empty tags / liquid syntax when no
 * provider is in scope (headless / isolated component tests).
 */
export function useMergeTagLabelResolver(): (text: string) => string {
  const mergeTags = inject(MERGE_TAGS_KEY, []);
  const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
  return (text: string) => resolveMergeTagLabelsText(text, mergeTags, syntax);
}
