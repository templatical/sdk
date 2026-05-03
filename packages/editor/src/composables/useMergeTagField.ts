import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
} from "@templatical/types";
import { computed, nextTick, ref, type ComputedRef, type Ref } from "vue";
import { useMergeTag } from "./useMergeTag";

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
  mergeTagEnabled: boolean;
  isRequestingMergeTag: Ref<boolean>;
  isEditing: Ref<boolean>;
  startEditing: () => void;
  stopEditing: () => void;
  handleInput: (event: Event) => void;
  clearValue: () => void;
  insertMergeTag: () => Promise<void>;
}

export function useMergeTagField(
  options: UseMergeTagFieldOptions,
): UseMergeTagFieldReturn {
  const { modelValue, emit, elementRef } = options;

  const {
    isEnabled: mergeTagEnabled,
    isRequesting: isRequestingMergeTag,
    isMergeTagValue,
    getMergeTagLabel,
    requestMergeTag,
    syntax,
  } = useMergeTag();

  const isEditing = ref(false);
  let insertingMergeTag = false;

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

    if (mergeTag) {
      const before = modelValue().slice(0, cursorPos);
      const after = modelValue().slice(cursorPos);
      const newValue = before + mergeTag.value + after;
      emit(newValue);

      isEditing.value = true;
      nextTick(() => {
        const newPos = cursorPos + mergeTag.value.length;
        elementRef.value?.focus();
        elementRef.value?.setSelectionRange(newPos, newPos);
      });
    }
  }

  return {
    segments,
    hasMergeTags,
    mergeTagEnabled,
    isRequestingMergeTag,
    isEditing,
    startEditing,
    stopEditing,
    handleInput,
    clearValue,
    insertMergeTag,
  };
}
