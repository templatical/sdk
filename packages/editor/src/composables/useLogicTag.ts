import type { LogicPair, LogicTag, SyntaxPreset } from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";
import { inject, ref, type Ref } from "vue";
import {
  LOGIC_PAIRS_KEY,
  LOGIC_TAG_PICKER_KEY,
  LOGIC_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_LOGIC_TAG_KEY,
} from "../keys";
import type { LogicTagPickerResult } from "./useLogicTagPicker";

export interface UseLogicTagReturn {
  /** Configured standalone logic tags. */
  logicTags: LogicTag[];
  /** Configured open/close logic pairs. */
  logicPairs: LogicPair[];
  /** Resolved syntax preset — shared with merge tags; drives keyword badges. */
  syntax: SyntaxPreset;
  /**
   * Whether the "Insert logic" affordance should show. True when at least one
   * logic tag or pair is configured.
   */
  canInsertLogicTag: boolean;
  /** Whether a logic pick is in progress. */
  isRequesting: Ref<boolean>;
  /**
   * Open the built-in logic picker. Resolves with the chosen tag/pair, or null
   * when nothing is configured, the picker is unavailable (headless), or the
   * user cancels.
   */
  requestLogicTag: () => Promise<LogicTagPickerResult | null>;
}

/**
 * Composable for the standalone logic-tag feature — separate from merge tags.
 * Exposes configured logic tags/pairs and opens the built-in logic picker.
 */
export function useLogicTag(): UseLogicTagReturn {
  const logicTags = inject(LOGIC_TAGS_KEY, []);
  const logicPairs = inject(LOGIC_PAIRS_KEY, []);
  const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
  const onRequest = inject(ON_REQUEST_LOGIC_TAG_KEY, null);
  // Picker may be null in headless contexts (tests, non-editor consumers).
  const picker = inject(LOGIC_TAG_PICKER_KEY, null);

  const isRequesting = ref(false);

  // Show the affordance when a consumer callback is set OR static config
  // exists — mirrors useMergeTag's canRequestMergeTag.
  const canInsertLogicTag =
    !!onRequest || logicTags.length > 0 || logicPairs.length > 0;

  const hasStaticLogic = logicTags.length > 0 || logicPairs.length > 0;

  /**
   * Request a logic tag/pair from the user. Precedence:
   *  1. `logic.onRequest` callback (consumer-owned UX)
   *  2. Built-in picker over `logic.tags` / `logic.pairs`
   *  3. null (nothing configured / headless)
   */
  async function requestLogicTag(): Promise<LogicTagPickerResult | null> {
    if (onRequest) {
      isRequesting.value = true;
      try {
        return await onRequest();
      } finally {
        isRequesting.value = false;
      }
    }
    if (picker && hasStaticLogic) {
      isRequesting.value = true;
      try {
        return await picker.open(logicTags, logicPairs);
      } finally {
        isRequesting.value = false;
      }
    }
    return null;
  }

  return {
    logicTags,
    logicPairs,
    syntax,
    canInsertLogicTag,
    isRequesting,
    requestLogicTag,
  };
}
