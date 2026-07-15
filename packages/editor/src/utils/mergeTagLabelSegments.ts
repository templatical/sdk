import {
  getLogicMergeTagKeyword,
  getMergeTagLabel,
  isLogicMergeTagValue,
  isMergeTagValue,
  type MergeTag,
  type SyntaxPreset,
} from "@templatical/types";

/** A run of a field value: plain text, or a resolved merge-tag label. */
export interface MergeTagLabelSegment {
  type: "text" | "tag";
  /** For `tag`, the resolved label/keyword; for `text`, the literal run. */
  value: string;
}

/**
 * Splits a plain-string field value into text runs and merge-tag runs, with
 * tags resolved to their human-readable label (data tags via `getMergeTagLabel`,
 * unknown tags falling back to their raw value) or keyword (logic tags).
 *
 * Used to render merge tags on the canvas for blocks that show a merge-tag-
 * enabled field directly as a string (button label, menu items, video/image
 * placeholders). Returning segments — rather than a flattened string — lets the
 * renderer mark the tag runs with a distinct cue so they're distinguishable
 * from user-typed text, mirroring the rich-text editor. The plain-text analog
 * of `resolveHtmlMergeTagLabels`, which only rewrites TipTap `<span>` markup.
 */
export function splitMergeTagLabelSegments(
  text: string,
  mergeTags: MergeTag[],
  syntax: SyntaxPreset,
): MergeTagLabelSegment[] {
  if (!text) return [];

  const regex = new RegExp(
    `(${syntax.value.source}|${syntax.logic.source})`,
    "g",
  );
  const segments: MergeTagLabelSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    const matched = match[0];
    if (isMergeTagValue(matched, syntax)) {
      segments.push({
        type: "tag",
        value: getMergeTagLabel(matched, mergeTags),
      });
    } else if (isLogicMergeTagValue(matched, syntax)) {
      segments.push({
        type: "tag",
        value: getLogicMergeTagKeyword(matched, syntax),
      });
    } else {
      segments.push({ type: "text", value: matched });
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
