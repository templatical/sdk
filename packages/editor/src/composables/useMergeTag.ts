import type {
  MergeTag,
  MergeTagRequestContext,
  SyntaxPreset,
} from "@templatical/types";
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
  MERGE_TAG_SHOW_RAW_VALUE_KEY,
  MERGE_TAG_REQUESTING_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  TRANSLATIONS_KEY,
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
   * The configured tag whose `value` is exactly `value`, or `undefined` when
   * the token matches nothing. Unlike `getMergeTagLabel`, absence is reported
   * rather than falling back to the raw token — callers deciding whether a
   * chip can be re-picked need to tell the two apart.
   */
  findMergeTag: (value: string) => MergeTag | undefined;
  /**
   * Whether activating a tag carrying `value` should open the chooser rather
   * than a raw text input.
   *
   * True when the consumer owns the chooser (`onRequest` decides for itself
   * what an unresolvable token means), or when the token resolves against
   * `tags` so the built-in picker has something to preselect. False otherwise,
   * which is the one case where editing the token as text is still the only
   * way to repair it.
   *
   * The single home for that rule: the canvas chip and a sidebar field chip
   * must not be able to answer it differently.
   */
  canRepickMergeTag: (value: string) => boolean;
  /**
   * What a tag renders as on screen.
   *
   * A declared tag shows its label. An undeclared token normally shows itself —
   * the editor makes a tag out of anything syntax-shaped, so the token is
   * usually the only thing identifying it. When the consumer hid raw tokens it
   * falls back to `storedLabel` (the label captured on the node when the tag
   * was inserted) and then to a neutral placeholder, so an opaque identifier
   * never reaches the screen.
   *
   * The single home for that chain: the canvas chip, its accessible name and a
   * sidebar field chip must all say the same thing.
   */
  getMergeTagDisplayLabel: (value: string, storedLabel?: string) => string;
  /**
   * Whether a tag's tooltip may reveal the raw token behind its label.
   * `false` when the consumer set `mergeTags.showRawValue: false`.
   */
  showRawValue: boolean;
  /**
   * Request a merge tag from the user. Precedence: when
   * `onRequestMergeTag` is set it owns the UX; otherwise the built-in
   * picker opens with the configured `mergeTags.tags`; otherwise null.
   *
   * `context` says whether this is an insertion or a replacement, and carries
   * the tag being replaced when one resolves.
   */
  requestMergeTag: (
    context?: MergeTagRequestContext,
  ) => Promise<MergeTag | null>;
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
  const showRawValue = inject(MERGE_TAG_SHOW_RAW_VALUE_KEY, true);
  // Injected directly rather than through `useI18n()`, which throws without a
  // provider — this composable is used headlessly too. The binding name is one
  // `i18n-key-usage.test.ts` recognises as a translations holder; an unlisted
  // name makes every key read through it look dead to that guard.
  const injectedTranslations = inject(TRANSLATIONS_KEY, null);
  const unknownLabel =
    injectedTranslations?.mergeTag.unknownLabel ?? "Merge tag";

  // Shared per editor so every host that can open the picker is visible to
  // useRichTextEditor's click-outside guard. See MERGE_TAG_REQUESTING_KEY.
  const isRequesting = inject(MERGE_TAG_REQUESTING_KEY, null) ?? ref(false);

  function isMergeTagValue(value: string): boolean {
    return checkIsMergeTagValue(value, syntax);
  }

  function getMergeTagLabel(value: string): string {
    return resolveMergeTagLabel(value, mergeTags);
  }

  function findMergeTag(value: string): MergeTag | undefined {
    return mergeTags.find((tag) => tag.value === value);
  }

  function canRepickMergeTag(value: string): boolean {
    return !!onRequestMergeTag || findMergeTag(value) !== undefined;
  }

  function getMergeTagDisplayLabel(
    value: string,
    storedLabel?: string,
  ): string {
    const declared = findMergeTag(value);
    if (declared) return declared.label;
    // Before the token, not after it. A consumer whose picker mints a tag
    // returns one that is in no `tags` array, and its label is written onto
    // the node — reaching for the token first renders a raw identifier the
    // instant the author picks a field. This costs nothing for a tag the
    // editor made itself: the input rule, the paste rule, normalization and
    // `parseHTML` all derive an undeclared tag's stored label from
    // `getMergeTagLabel`, which returns the token, so the two agree already.
    if (storedLabel?.trim()) return storedLabel.trim();
    return showRawValue ? value : unknownLabel;
  }

  /**
   * Request a merge tag from the user. Precedence:
   *  1. `onRequestMergeTag` callback (consumer-owned UX)
   *  2. Built-in picker over `mergeTags.tags`
   *  3. null (nothing configured)
   */
  async function requestMergeTag(
    context?: MergeTagRequestContext,
  ): Promise<MergeTag | null> {
    if (onRequestMergeTag) {
      isRequesting.value = true;
      try {
        return await onRequestMergeTag(context);
      } finally {
        isRequesting.value = false;
      }
    }
    if (mergeTags.length > 0 && picker) {
      isRequesting.value = true;
      try {
        return await picker.open(mergeTags, { current: context?.current });
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
    findMergeTag,
    canRepickMergeTag,
    getMergeTagDisplayLabel,
    showRawValue,
    requestMergeTag,
  };
}
