import type { UseEditorReturn } from "@templatical/core";
import type { Editor } from "@tiptap/core";
import type { EditorContent as EditorContentComponent } from "@tiptap/vue-3";
import type { Extension, Mark, Node } from "@tiptap/core";
import { useEventListener, useTimeoutFn } from "@vueuse/core";
import {
  inject,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type Ref,
  type ShallowRef,
} from "vue";
import { useMergeTag } from "./useMergeTag";
import { useRichTextLinkDialog } from "./useRichTextLinkDialog";

export interface MergeTagContext {
  mergeTags: ReturnType<typeof useMergeTag>["mergeTags"];
  syntax: ReturnType<typeof useMergeTag>["syntax"];
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
  mergeTagEnabled: ReturnType<typeof useMergeTag>["isEnabled"];
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
  const emailEditor = inject<UseEditorReturn>("editor");

  const {
    mergeTags,
    isEnabled: mergeTagEnabled,
    isRequesting: isRequestingMergeTag,
    requestMergeTag,
    syntax,
  } = useMergeTag();

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

  const editor = shallowRef<Editor | null>(null);
  const EditorContent = shallowRef<typeof EditorContentComponent | null>(null);
  const isLoading = ref(true);
  const initError = ref<string | null>(null);

  async function initEditor(): Promise<void> {
    initError.value = null;
    isLoading.value = true;

    try {
      const { TiptapEditor, EC, extensions } = await options.loadExtensions({
        mergeTags,
        syntax,
      });

      EditorContent.value = EC;

      const seen = new Map<string, number>();
      extensions.forEach((ext, i) => seen.set(ext.name, i));
      const uniqueExtensions = extensions.filter(
        (ext, i) => seen.get(ext.name) === i,
      );

      editor.value = new TiptapEditor({
        extensions: uniqueExtensions,
        content: options.blockContent(),
        editable: true,
        onUpdate: ({ editor: e }) => {
          if (emailEditor) {
            emailEditor.updateBlock(options.blockId(), {
              content: e.getHTML(),
            });
          }
        },
      });

      isLoading.value = false;
      startFocusTimeout();
    } catch (error) {
      console.error(
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

  watch(
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
    mergeTagEnabled,
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
