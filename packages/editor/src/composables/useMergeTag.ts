import type { MergeTag, SyntaxPreset } from "@templatical/types";
import {
  isMergeTagValue as checkIsMergeTagValue,
  getMergeTagLabel as resolveMergeTagLabel,
  SYNTAX_PRESETS,
} from "@templatical/types";
import { inject, ref, type Ref } from "vue";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  MERGE_TAG_AUTOCOMPLETE_KEY,
  MERGE_TAG_PICKER_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
} from "../keys";

export interface UseMergeTagReturn {
  /** Available merge tags from config */
  mergeTags: MergeTag[];
  /** Whether a merge tag request is in progress */
  isRequesting: Ref<boolean>;
  /**
   * Whether the "Insert merge tag" button should be shown. True when
   * either `onRequestMergeTag` is provided or `mergeTags.tags` is
   * non-empty (the built-in picker then handles the click).
   */
  canRequestMergeTag: boolean;
  /** Whether typing-based autocomplete is enabled by configuration */
  autocomplete: boolean;
  /** The resolved syntax preset for merge tags */
  syntax: SyntaxPreset;
  /** Check if a value matches the configured merge tag syntax */
  isMergeTagValue: (value: string) => boolean;
  /** Get the human-readable label for a merge tag value */
  getMergeTagLabel: (value: string) => string;
  /**
   * Request a merge tag from the user. Precedence: when
   * `onRequestMergeTag` is set it owns the UX; otherwise the built-in
   * picker opens with the configured `mergeTags.tags`; otherwise null.
   */
  requestMergeTag: () => Promise<MergeTag | null>;
}

/**
 * Composable for merge tag functionality.
 * Provides utilities for detecting, displaying, and requesting merge tags.
 */
export function useMergeTag(): UseMergeTagReturn {
  const mergeTags = inject(MERGE_TAGS_KEY, []);
  const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
  const onRequestMergeTag = inject(ON_REQUEST_MERGE_TAG_KEY, null);
  const autocomplete = inject(MERGE_TAG_AUTOCOMPLETE_KEY, true);
  // Picker may be null in headless contexts (tests, non-editor consumers).
  // requestMergeTag() returns null in that case rather than throwing.
  const picker = inject(MERGE_TAG_PICKER_KEY, null);

  const isRequesting = ref(false);

  function isMergeTagValue(value: string): boolean {
    return checkIsMergeTagValue(value, syntax);
  }

  function getMergeTagLabel(value: string): string {
    return resolveMergeTagLabel(value, mergeTags);
  }

  /**
   * Request a merge tag from the user. Precedence:
   *  1. `onRequestMergeTag` callback (consumer-owned UX)
   *  2. Built-in picker over `mergeTags.tags`
   *  3. null (nothing configured)
   */
  async function requestMergeTag(): Promise<MergeTag | null> {
    if (onRequestMergeTag) {
      isRequesting.value = true;
      try {
        return await onRequestMergeTag();
      } finally {
        isRequesting.value = false;
      }
    }
    if (mergeTags.length > 0 && picker) {
      isRequesting.value = true;
      try {
        return await picker.open(mergeTags);
      } finally {
        isRequesting.value = false;
      }
    }
    return null;
  }

  const canRequestMergeTag = !!onRequestMergeTag || mergeTags.length > 0;

  return {
    mergeTags,
    isRequesting,
    canRequestMergeTag,
    autocomplete,
    syntax,
    isMergeTagValue,
    getMergeTagLabel,
    requestMergeTag,
  };
}
