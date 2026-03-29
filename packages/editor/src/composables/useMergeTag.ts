import type { MergeTag, SyntaxPreset } from "@templatical/types";
import {
  isMergeTagValue as checkIsMergeTagValue,
  getMergeTagLabel as resolveMergeTagLabel,
  SYNTAX_PRESETS,
} from "@templatical/types";
import { inject, ref, type Ref } from "vue";

export interface UseMergeTagReturn {
  /** Available merge tags from config */
  mergeTags: MergeTag[];
  /** Whether a merge tag request is in progress */
  isRequesting: Ref<boolean>;
  /** Whether merge tag functionality is enabled (has merge tags and callback) */
  isEnabled: boolean;
  /** The resolved syntax preset for merge tags */
  syntax: SyntaxPreset;
  /** Check if a value matches the configured merge tag syntax */
  isMergeTagValue: (value: string) => boolean;
  /** Get the human-readable label for a merge tag value */
  getMergeTagLabel: (value: string) => string;
  /** Request a merge tag from the user via the configured callback */
  requestMergeTag: () => Promise<MergeTag | null>;
}

/**
 * Composable for merge tag functionality.
 * Provides utilities for detecting, displaying, and requesting merge tags.
 */
export function useMergeTag(): UseMergeTagReturn {
  const mergeTags = inject<MergeTag[]>("mergeTags", []);
  const syntax = inject<SyntaxPreset>("mergeTagSyntax", SYNTAX_PRESETS.liquid);
  const onRequestMergeTag = inject<
    (() => Promise<MergeTag | null>) | undefined
  >("onRequestMergeTag");

  const isRequesting = ref(false);

  function isMergeTagValue(value: string): boolean {
    return checkIsMergeTagValue(value, syntax);
  }

  function getMergeTagLabel(value: string): string {
    return resolveMergeTagLabel(value, mergeTags);
  }

  /**
   * Request a merge tag from the user via the configured callback.
   * Returns null if no callback is configured or user cancels.
   */
  async function requestMergeTag(): Promise<MergeTag | null> {
    if (!onRequestMergeTag) {
      return null;
    }

    isRequesting.value = true;
    try {
      return await onRequestMergeTag();
    } finally {
      isRequesting.value = false;
    }
  }

  // Merge tag functionality is enabled when either:
  // 1. There are merge tags configured (non-empty array), OR
  // 2. The onRequestMergeTag callback is provided
  const isEnabled = mergeTags.length > 0 || !!onRequestMergeTag;

  return {
    mergeTags,
    isRequesting,
    isEnabled,
    syntax,
    isMergeTagValue,
    getMergeTagLabel,
    requestMergeTag,
  };
}
