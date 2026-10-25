import type {
  AiMergeTag,
  AiMergeTagSyntax,
  AiMergeTags,
  MergeTag,
  SyntaxPreset,
  SyntaxPresetName,
} from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";

/** The wire's caps on merge tags, in code points (S7 Y5, S8 X4). */
export const AI_MERGE_TAG_LIMITS = {
  tags: 500,
  value: 200,
  label: 100,
  group: 100,
  description: 200,
} as const;

/** `text` cut to `max` code points, so a surrogate pair is never split. */
function truncate(text: string, max: number): string {
  const points = Array.from(text);
  return points.length > max ? points.slice(0, max).join("") : text;
}

/** The built-in preset whose patterns the syntax carries, or `custom`. */
export function mergeTagSyntaxName(syntax: SyntaxPreset): AiMergeTagSyntax {
  for (const name of Object.keys(SYNTAX_PRESETS) as SyntaxPresetName[]) {
    const preset = SYNTAX_PRESETS[name];
    if (
      preset.value.source === syntax.value.source &&
      preset.logic.source === syntax.logic.source
    ) {
      return name;
    }
  }
  return "custom";
}

/**
 * The editor's merge tags as an AI request carries them, within the caps:
 * at most 500 in order; a value that is empty or over 200 code points is left
 * out (a cut value names another tag); label, group and description are cut;
 * an empty label falls back to the value; `sample` never travels. The syntax
 * travels even when no tag is declared (`tags: []`).
 */
export function toAiMergeTags(
  tags: readonly MergeTag[],
  syntax: SyntaxPreset,
): AiMergeTags {
  const out: AiMergeTag[] = [];
  for (const tag of tags) {
    if (out.length === AI_MERGE_TAG_LIMITS.tags) break;
    const value = typeof tag?.value === "string" ? tag.value : "";
    if (value === "" || Array.from(value).length > AI_MERGE_TAG_LIMITS.value)
      continue;
    const label =
      typeof tag.label === "string" && tag.label !== "" ? tag.label : value;
    out.push({
      value,
      label: truncate(label, AI_MERGE_TAG_LIMITS.label),
      ...(typeof tag.group === "string" && tag.group !== ""
        ? { group: truncate(tag.group, AI_MERGE_TAG_LIMITS.group) }
        : {}),
      ...(typeof tag.description === "string" && tag.description !== ""
        ? {
            description: truncate(
              tag.description,
              AI_MERGE_TAG_LIMITS.description,
            ),
          }
        : {}),
    });
  }
  return { syntax: mergeTagSyntaxName(syntax), tags: out };
}
