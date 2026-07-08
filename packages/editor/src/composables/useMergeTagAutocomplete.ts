import {
  getSyntaxClosingChar,
  getSyntaxTriggerChar,
  type MergeTag,
  type SyntaxPreset,
} from "@templatical/types";
import {
  getCurrentScope,
  inject,
  isRef,
  nextTick,
  onScopeDispose,
  type Ref,
} from "vue";
import type { Translations } from "../i18n";
import { TRANSLATIONS_KEY } from "../keys";
import {
  createMergeTagPopup,
  filterMergeTags,
} from "../extensions/MergeTagSuggestion";
import {
  findOpenMergeTagTrigger,
  type OpenMergeTagTrigger,
} from "../utils/mergeTagTrigger";
import { getCaretRect } from "../utils/textFieldCaret";
import { usePopoverRoot } from "./usePopoverRoot";

export interface UseMergeTagAutocompleteOptions {
  /** The `<input>` / `<textarea>` the popup anchors to. */
  elementRef: Ref<HTMLInputElement | HTMLTextAreaElement | null>;
  /** Reads the current field value. */
  modelValue: () => string;
  /** Emits a new field value. */
  emit: (value: string) => void;
  /** Available merge tags (the autocomplete filter source). */
  mergeTags: MergeTag[];
  /** Resolved merge-tag syntax. */
  syntax: SyntaxPreset;
  /** Consumer's `mergeTags.autocomplete` flag. */
  enabled: boolean;
  /**
   * Invoked right before a picked tag is emitted, so the field can keep edit
   * mode and not flip to the chip display while the caret is still active.
   */
  onInsert?: () => void;
}

export interface UseMergeTagAutocompleteReturn {
  /**
   * Whether autocomplete can ever fire. Mirrors the rich-text gate exactly:
   * enabled + a built-in trigger syntax + at least one tag to filter.
   */
  available: boolean;
  /** Recompute the popup after the value or caret changed. */
  refresh: () => void;
  /**
   * Field `keydown` handler. Returns `true` when the popup consumed the key
   * (the caller must then `preventDefault`); `false` to let the field handle it.
   */
  handleKeydown: (event: KeyboardEvent) => boolean;
  /** Close the popup (e.g. on blur). Idempotent. */
  close: () => void;
  /** Whether the popup is currently open. */
  isOpen: () => boolean;
}

// Horizontal caret moves take the caret out of the query run — dismiss the
// popup (like navigating away in the rich-text editor) and let the caret move.
const CARET_MOVE_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * Type-ahead merge-tag autocomplete for a native `<input>` / `<textarea>`.
 *
 * Drives the SAME popup controller as the rich-text (`@tiptap/suggestion`)
 * path — see `createMergeTagPopup` — so the popup's rendering, positioning,
 * keyboard behavior, and ARIA are identical across both surfaces. The only
 * field-specific work is here: detecting the open trigger in the raw string
 * (`findOpenMergeTagTrigger`), measuring the caret rect without ProseMirror
 * (`getCaretRect`), and replacing the typed fragment with the picked tag.
 */
export function useMergeTagAutocomplete(
  options: UseMergeTagAutocompleteOptions,
): UseMergeTagAutocompleteReturn {
  const { elementRef, modelValue, emit, mergeTags, syntax, enabled, onInsert } =
    options;

  const triggerChar = getSyntaxTriggerChar(syntax);
  const closingChar = getSyntaxClosingChar(syntax);
  const available = enabled && triggerChar !== null && mergeTags.length > 0;

  // Resolve the empty-state label the same way the rich-text path does —
  // inject with a null default so headless callers (no translations provider)
  // don't throw, falling back to the English string.
  const injectedTranslations = inject(TRANSLATIONS_KEY, null) as
    Translations | Ref<Translations> | null;
  const resolvedTranslations = isRef(injectedTranslations)
    ? injectedTranslations.value
    : injectedTranslations;
  const emptyText =
    resolvedTranslations?.mergeTag?.suggestionEmpty ?? "No matching merge tags";

  const popoverRoot = usePopoverRoot();
  const popup = createMergeTagPopup(emptyText, popoverRoot);

  let disposed = false;
  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      popup.close();
    });
  }

  function currentMatch(el: HTMLInputElement | HTMLTextAreaElement) {
    const value = el.value ?? "";
    const caret = el.selectionStart ?? value.length;
    return findOpenMergeTagTrigger(
      value,
      caret,
      triggerChar as string,
      closingChar,
    );
  }

  function applySelection(
    el: HTMLInputElement | HTMLTextAreaElement,
    match: OpenMergeTagTrigger,
    tag: MergeTag,
  ): void {
    const value = el.value ?? modelValue();
    // Absorb a matching closer sitting immediately after the caret so
    // `{{fir}}` → pick → `{{first_name}}`, never `{{first_name}}}}`.
    const afterCaret = value.slice(match.caret);
    const trailing =
      closingChar && afterCaret.startsWith(closingChar)
        ? closingChar.length
        : 0;
    const before = value.slice(0, match.triggerStart);
    const after = value.slice(match.caret + trailing);
    const newValue = before + tag.value + after;
    const newPos = before.length + tag.value.length;

    // Keep the field in edit mode BEFORE emitting: once the value gains a tag,
    // `hasMergeTags` flips true, and without this the field would swap to the
    // chip display and unmount the input mid-insert.
    onInsert?.();
    emit(newValue);
    popup.close();

    nextTick(() => {
      if (disposed) return;
      const node = elementRef.value;
      node?.focus();
      node?.setSelectionRange(newPos, newPos);
    });
  }

  function refresh(): void {
    if (!available || disposed) return;
    const el = elementRef.value;
    if (!el) {
      popup.close();
      return;
    }
    const match = currentMatch(el);
    if (!match) {
      popup.close();
      return;
    }

    const items = filterMergeTags(mergeTags, match.query);
    const getRect = () => getCaretRect(el, match.triggerStart);
    const onCommand = (tag: MergeTag) => applySelection(el, match, tag);

    if (popup.isOpen()) {
      popup.update({ items, getRect, onCommand });
    } else {
      popup.open({ items, getRect, anchorEl: el, onCommand });
    }
  }

  function handleKeydown(event: KeyboardEvent): boolean {
    if (!popup.isOpen()) return false;
    if (event.key === "Escape") {
      popup.close();
      return true;
    }
    if (CARET_MOVE_KEYS.has(event.key)) {
      popup.close();
      return false;
    }
    return popup.handleKeyDown(event);
  }

  return {
    available,
    refresh,
    handleKeydown,
    close: () => popup.close(),
    isOpen: () => popup.isOpen(),
  };
}
