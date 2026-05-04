import type {
  Editor,
  EditorContent as EditorContentComponent,
} from "@tiptap/vue-3";
import type { Extension, Mark, Node } from "@tiptap/core";
import { useEventListener, useTimeoutFn } from "@vueuse/core";
import {
  inject,
  isRef,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type Ref,
  type ShallowRef,
} from "vue";
import type { Translations } from "../i18n";
import { getSyntaxTriggerChar } from "@templatical/types";
import { EDITOR_KEY, TRANSLATIONS_KEY } from "../keys";
import { useMergeTag } from "./useMergeTag";
import { useRichTextLinkDialog } from "./useRichTextLinkDialog";
import { logger } from "../utils/logger";

export interface MergeTagContext {
  mergeTags: ReturnType<typeof useMergeTag>["mergeTags"];
  syntax: ReturnType<typeof useMergeTag>["syntax"];
  /** Resolved trigger string for built-in syntaxes; null for custom syntax. */
  triggerChar: string | null;
  /** Whether the consumer has enabled autocomplete (default true). */
  autocompleteEnabled: boolean;
  /** Localized empty-state label for the autocomplete popup. */
  suggestionEmptyText: string;
}

export interface UseRichTextEditorOptions {
  blockId: () => string;
  blockContent: () => string;
  loadExtensions: (ctx: MergeTagContext) => Promise<{
    TiptapEditor: typeof Editor;
    EC: typeof EditorContentComponent;
    extensions: (Extension | Mark | Node)[];
  }>;
  onDone: () => void;
  onClickOutsideSideEffect?: (target: HTMLElement) => void;
  editorName?: string;
}

export interface UseRichTextEditorReturn {
  editor: ShallowRef<Editor | null>;
  EditorContent: ShallowRef<typeof EditorContentComponent | null>;
  isLoading: Ref<boolean>;
  initError: Ref<string | null>;
  retry: () => void;
  showLinkDialog: Ref<boolean>;
  linkUrl: Ref<string>;
  linkDialogRef: Ref<HTMLElement | null>;
  mergeTags: ReturnType<typeof useMergeTag>["mergeTags"];
  canRequestMergeTag: ReturnType<typeof useMergeTag>["canRequestMergeTag"];
  isRequestingMergeTag: ReturnType<typeof useMergeTag>["isRequesting"];
  syntax: ReturnType<typeof useMergeTag>["syntax"];
  openLinkDialog: () => void;
  insertLink: () => void;
  removeLink: () => void;
  closeLinkDialog: () => void;
  handleLinkKeydown: (event: KeyboardEvent) => void;
  handleAddMergeTag: () => Promise<void>;
}

export function useRichTextEditor(
  options: UseRichTextEditorOptions,
): UseRichTextEditorReturn {
  const emailEditor = inject(EDITOR_KEY, null);

  const {
    mergeTags,
    canRequestMergeTag,
    isRequesting: isRequestingMergeTag,
    requestMergeTag,
    syntax,
    autocomplete: autocompleteEnabled,
  } = useMergeTag();

  const injectedTranslations = inject(TRANSLATIONS_KEY, null) as
    | Translations
    | Ref<Translations>
    | null;
  const resolvedTranslations: Translations | null = isRef(injectedTranslations)
    ? injectedTranslations.value
    : injectedTranslations;
  const suggestionEmptyText =
    resolvedTranslations?.mergeTag?.suggestionEmpty ?? "No matching merge tags";
  const triggerChar = getSyntaxTriggerChar(syntax);

  const editor = shallowRef<Editor | null>(null);

  const {
    showLinkDialog,
    linkUrl,
    linkDialogRef,
    openLinkDialog,
    insertLink,
    removeLink,
    closeLinkDialog,
    handleLinkKeydown,
  } = useRichTextLinkDialog(editor);

  const { start: startFocusTimeout, stop: stopFocusTimeout } = useTimeoutFn(
    () => editor.value?.commands.focus("end"),
    0,
    { immediate: false },
  );
  const EditorContent = shallowRef<typeof EditorContentComponent | null>(null);
  const isLoading = ref(true);
  const initError = ref<string | null>(null);

  let destroyed = false;

  async function initEditor(): Promise<void> {
    initError.value = null;
    isLoading.value = true;

    try {
      const { TiptapEditor, EC, extensions } = await options.loadExtensions({
        mergeTags,
        syntax,
        triggerChar,
        autocompleteEnabled,
        suggestionEmptyText,
      });

      // Component unmounted while we awaited loadExtensions — bail out
      // before constructing the TipTap editor. Otherwise the editor escapes
      // the onBeforeUnmount destroy hook that already ran.
      if (destroyed) {
        return;
      }

      EditorContent.value = EC;

      const seen = new Map<string, number>();
      extensions.forEach((ext, i) => seen.set(ext.name, i));
      const uniqueExtensions = extensions.filter(
        (ext, i) => seen.get(ext.name) === i,
      );

      const instance = new TiptapEditor({
        extensions: uniqueExtensions,
        content: options.blockContent(),
        editable: true,
        onUpdate: ({ editor: e }) => {
          if (destroyed) return;
          if (emailEditor) {
            emailEditor.updateBlock(options.blockId(), {
              content: e.getHTML(),
            });
          }
        },
      });

      // A second unmount check covers the gap between `await` resolving and
      // the constructor running.
      if (destroyed) {
        instance.destroy();
        return;
      }

      editor.value = instance;
      isLoading.value = false;
      startFocusTimeout();
    } catch (error) {
      if (destroyed) return;
      logger.error(
        `[${options.editorName ?? "RichTextEditor"}] Failed to initialize TipTap editor:`,
        error,
      );
      initError.value =
        error instanceof Error ? error.message : "Failed to load editor";
      isLoading.value = false;
    }
  }

  function retry(): void {
    editor.value?.destroy();
    editor.value = null;
    initEditor();
  }

  initEditor();

  const stopContentWatch = watch(
    () => options.blockContent(),
    (newContent) => {
      if (editor.value) {
        const currentContent = editor.value.getHTML();
        if (currentContent !== newContent) {
          editor.value.commands.setContent(newContent, { emitUpdate: false });
        }
      }
    },
  );

  function handleClickOutside(event: MouseEvent): void {
    if (isRequestingMergeTag.value) return;

    const target = event.target as HTMLElement;

    options.onClickOutsideSideEffect?.(target);

    if (
      target.closest(".tpl-text-editor-wrapper") ||
      target.closest(".tpl-text-toolbar") ||
      target.closest(".tpl-link-dialog")
    ) {
      return;
    }

    options.onDone();
  }

  useEventListener(document, "mousedown", handleClickOutside);

  onBeforeUnmount(() => {
    destroyed = true;
    stopContentWatch();
    stopFocusTimeout();
    editor.value?.destroy();
  });

  async function handleAddMergeTag(): Promise<void> {
    const mergeTag = await requestMergeTag();
    if (mergeTag && editor.value) {
      editor.value
        .chain()
        .focus()
        .insertMergeTag({
          label: mergeTag.label,
          value: mergeTag.value,
        })
        .run();
    } else {
      editor.value?.commands.focus();
    }
  }

  return {
    editor,
    EditorContent,
    isLoading,
    initError,
    retry,
    showLinkDialog,
    linkUrl,
    linkDialogRef,
    mergeTags,
    canRequestMergeTag,
    isRequestingMergeTag,
    syntax,
    openLinkDialog,
    insertLink,
    removeLink,
    closeLinkDialog,
    handleLinkKeydown,
    handleAddMergeTag,
  };
}
