import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
} from "@templatical/types";
import {
  computed,
  getCurrentScope,
  nextTick,
  onScopeDispose,
  ref,
  type ComputedRef,
  type Ref,
} from "vue";
import { useMergeTag } from "./useMergeTag";
import { useLogicTag } from "./useLogicTag";
import { useMergeTagAutocomplete } from "./useMergeTagAutocomplete";

export type MergeTagSegment =
  | { type: "text"; value: string }
  | { type: "mergeTag"; value: string; label: string }
  | { type: "logicMergeTag"; value: string; keyword: string };

export interface UseMergeTagFieldOptions {
  modelValue: () => string;
  emit: (value: string) => void;
  elementRef: Ref<HTMLInputElement | HTMLTextAreaElement | null>;
}

export interface UseMergeTagFieldReturn {
  segments: ComputedRef<MergeTagSegment[]>;
  hasMergeTags: ComputedRef<boolean>;
  canRequestMergeTag: boolean;
  isRequestingMergeTag: Ref<boolean>;
  canInsertLogicTag: boolean;
  isRequestingLogicTag: Ref<boolean>;
  isEditing: Ref<boolean>;
  startEditing: () => void;
  stopEditing: () => void;
  handleInput: (event: Event) => void;
  handleKeydown: (event: KeyboardEvent) => void;
  handleClick: () => void;
  handleBlur: () => void;
  clearValue: () => void;
  insertMergeTag: () => Promise<void>;
  insertLogicTag: () => Promise<void>;
  /** Whether type-ahead autocomplete is active for this field. */
  autocompleteAvailable: boolean;
}

export function useMergeTagField(
  options: UseMergeTagFieldOptions,
): UseMergeTagFieldReturn {
  const { modelValue, emit, elementRef } = options;

  const {
    mergeTags,
    canRequestMergeTag,
    isRequesting: isRequestingMergeTag,
    isMergeTagValue,
    getMergeTagLabel,
    requestMergeTag,
    syntax,
    autocomplete,
  } = useMergeTag();

  const {
    canInsertLogicTag,
    isRequesting: isRequestingLogicTag,
    requestLogicTag,
  } = useLogicTag();

  const isEditing = ref(false);
  let insertingMergeTag = false;
  let disposed = false;
  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
    });
  }

  // Type-ahead autocomplete for the raw <input>/<textarea>, sharing the exact
  // popup used by the rich-text editor. `onInsert` keeps the field in edit mode
  // so the freshly inserted tag stays visible instead of flipping to chips.
  const typeahead = useMergeTagAutocomplete({
    elementRef,
    modelValue,
    emit,
    mergeTags,
    syntax,
    enabled: autocomplete,
    onInsert: () => {
      isEditing.value = true;
    },
  });

  const segments = computed((): MergeTagSegment[] => {
    const val = modelValue();
    if (!val) return [];

    const result: MergeTagSegment[] = [];
    const combinedSource = `(${syntax.value.source}|${syntax.logic.source})`;
    const regex = new RegExp(combinedSource, "g");
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(val)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: "text",
          value: val.slice(lastIndex, match.index),
        });
      }

      const matched = match[0];
      if (isMergeTagValue(matched)) {
        result.push({
          type: "mergeTag",
          value: matched,
          label: getMergeTagLabel(matched),
        });
      } else if (isLogicMergeTagValue(matched, syntax)) {
        result.push({
          type: "logicMergeTag",
          value: matched,
          keyword: getLogicMergeTagKeyword(matched, syntax),
        });
      } else {
        result.push({ type: "text", value: matched });
      }

      lastIndex = match.index + matched.length;
    }

    if (lastIndex < val.length) {
      result.push({ type: "text", value: val.slice(lastIndex) });
    }

    return result;
  });

  const hasMergeTags = computed(() =>
    segments.value.some(
      (s) => s.type === "mergeTag" || s.type === "logicMergeTag",
    ),
  );

  function startEditing(): void {
    isEditing.value = true;
    nextTick(() => {
      elementRef.value?.focus();
      const len = modelValue()?.length || 0;
      elementRef.value?.setSelectionRange(len, len);
    });
  }

  function stopEditing(): void {
    if (insertingMergeTag) return;
    isEditing.value = false;
  }

  function handleInput(event: Event): void {
    emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
    typeahead.refresh();
  }

  /**
   * Field keydown: let the autocomplete popup consume navigation/selection
   * keys first (Arrow/Enter/Tab/Escape). If it doesn't, Escape falls through
   * to leaving edit mode — preserving the prior `@keydown.escape` behavior.
   */
  function handleKeydown(event: KeyboardEvent): void {
    if (typeahead.handleKeydown(event)) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      stopEditing();
    }
  }

  /** A click may move the caret into or out of a trigger — re-evaluate. */
  function handleClick(): void {
    typeahead.refresh();
  }

  /** Blur closes the popup, then leaves edit mode. */
  function handleBlur(): void {
    typeahead.close();
    stopEditing();
  }

  function clearValue(): void {
    emit("");
  }

  async function insertMergeTag(): Promise<void> {
    const cursorPos =
      isEditing.value && elementRef.value
        ? (elementRef.value.selectionStart ?? modelValue().length)
        : modelValue().length;

    insertingMergeTag = true;
    let mergeTag: Awaited<ReturnType<typeof requestMergeTag>>;
    try {
      mergeTag = await requestMergeTag();
    } finally {
      insertingMergeTag = false;
    }

    if (disposed) return;

    if (mergeTag) {
      const before = modelValue().slice(0, cursorPos);
      const after = modelValue().slice(cursorPos);
      const newValue = before + mergeTag.value + after;
      emit(newValue);

      isEditing.value = true;
      nextTick(() => {
        if (disposed) return;
        const newPos = cursorPos + mergeTag.value.length;
        elementRef.value?.focus();
        elementRef.value?.setSelectionRange(newPos, newPos);
      });
    }
  }

  async function insertLogicTag(): Promise<void> {
    // Read the selection straight from the element (kept focused via the
    // button's mousedown.prevent). Null only in display mode → append at end.
    const el = elementRef.value;
    const start = el?.selectionStart ?? modelValue().length;
    const end = el?.selectionEnd ?? start;

    insertingMergeTag = true;
    let item: Awaited<ReturnType<typeof requestLogicTag>>;
    try {
      item = await requestLogicTag();
    } finally {
      insertingMergeTag = false;
    }

    if (disposed || !item) return;

    const val = modelValue();
    let newValue: string;
    let newPos: number;
    if ("before" in item) {
      // Pair: wrap the selection with before/after. With no selection
      // (start === end) the caret lands between them so the user types the
      // wrapped content — mirrors the rich-text behavior.
      newValue =
        val.slice(0, start) +
        item.before +
        val.slice(start, end) +
        item.after +
        val.slice(end);
      newPos = start + item.before.length + (end - start);
    } else {
      // Tag: insert at the cursor.
      newValue = val.slice(0, start) + item.value + val.slice(start);
      newPos = start + item.value.length;
    }
    emit(newValue);

    isEditing.value = true;
    nextTick(() => {
      if (disposed) return;
      elementRef.value?.focus();
      elementRef.value?.setSelectionRange(newPos, newPos);
    });
  }

  return {
    segments,
    hasMergeTags,
    canRequestMergeTag,
    isRequestingMergeTag,
    canInsertLogicTag,
    isRequestingLogicTag,
    isEditing,
    startEditing,
    stopEditing,
    handleInput,
    handleKeydown,
    handleClick,
    handleBlur,
    clearValue,
    insertMergeTag,
    insertLogicTag,
    autocompleteAvailable: typeahead.available,
  };
}
