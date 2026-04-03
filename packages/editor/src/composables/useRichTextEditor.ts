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
import { useFocusTrap } from "./useFocusTrap";
import { useMergeTag } from "./useMergeTag";

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

  const showLinkDialog = ref(false);
  const linkUrl = ref("");
  const linkDialogRef = ref<HTMLElement | null>(null);
  useFocusTrap(linkDialogRef, showLinkDialog);

  const { start: startFocusTimeout, stop: stopFocusTimeout } = useTimeoutFn(
    () => editor.value?.commands.focus("end"),
    0,
    { immediate: false },
  );

  const editor = shallowRef<Editor | null>(null);
  const EditorContent = shallowRef<typeof EditorContentComponent | null>(null);
  const isLoading = ref(true);

  async function initEditor(): Promise<void> {
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
      isLoading.value = false;
    }
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

  function openLinkDialog(): void {
    const previousUrl = editor.value?.getAttributes("link").href || "";
    linkUrl.value = previousUrl;
    showLinkDialog.value = true;
  }

  function insertLink(): void {
    if (linkUrl.value) {
      const url = linkUrl.value.startsWith("http")
        ? linkUrl.value
        : `https://${linkUrl.value}`;
      editor.value
        ?.chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    closeLinkDialog();
  }

  function removeLink(): void {
    editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
    closeLinkDialog();
  }

  function closeLinkDialog(): void {
    showLinkDialog.value = false;
    linkUrl.value = "";
  }

  function handleLinkKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      insertLink();
    } else if (event.key === "Escape") {
      closeLinkDialog();
    }
  }

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
