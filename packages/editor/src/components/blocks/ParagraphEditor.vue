<script setup lang="ts">
import { useRichTextEditor } from "../../composables/useRichTextEditor";
import type { ParagraphBlock as ParagraphBlockType } from "@templatical/types";
import ParagraphToolbar from "./ParagraphToolbar.vue";
import RichTextLinkDialog from "./RichTextLinkDialog.vue";
import RichTextEditorContent from "./RichTextEditorContent.vue";

const props = defineProps<{
  block: ParagraphBlockType;
  toolbarPosition: { top: number; left: number };
}>();

const emit = defineEmits<{
  (e: "done"): void;
}>();

const {
  editor,
  EditorContent,
  isLoading,
  initError,
  retry,
  showLinkDialog,
  linkUrl,
  linkDialogRef,
  mergeTagEnabled,
  openLinkDialog,
  insertLink,
  removeLink,
  closeLinkDialog,
  handleLinkKeydown,
  handleAddMergeTag,
} = useRichTextEditor({
  blockId: () => props.block.id,
  blockContent: () => props.block.content,
  onDone: () => emit("done"),
  editorName: "ParagraphEditor",
  async loadExtensions({ mergeTags, syntax }) {
    const [
      { Editor: TiptapEditor },
      { EditorContent: EC },
      { default: StarterKit },
      { default: LinkExt },
      { default: UnderlineExt },
      { default: SubscriptExt },
      { default: SuperscriptExt },
      { default: TextAlign },
      { TextStyle },
      { default: Color },
      { default: FontFamily },
      { default: Highlight },
      { MergeTagNode, LogicMergeTagNode, FontSize, LineHeight, LetterSpacing },
    ] = await Promise.all([
      import("@tiptap/core"),
      import("@tiptap/vue-3"),
      import("@tiptap/starter-kit"),
      import("@tiptap/extension-link"),
      import("@tiptap/extension-underline"),
      import("@tiptap/extension-subscript"),
      import("@tiptap/extension-superscript"),
      import("@tiptap/extension-text-align"),
      import("@tiptap/extension-text-style"),
      import("@tiptap/extension-color"),
      import("@tiptap/extension-font-family"),
      import("@tiptap/extension-highlight"),
      import("../../extensions"),
    ]);

    return {
      TiptapEditor,
      EC,
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
        }),
        UnderlineExt,
        SubscriptExt,
        SuperscriptExt,
        LinkExt.configure({
          openOnClick: false,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }),
        TextAlign.configure({ types: ["paragraph"] }),
        TextStyle,
        Color,
        FontFamily,
        Highlight.configure({ multicolor: true }),
        FontSize,
        LineHeight,
        LetterSpacing,
        MergeTagNode.configure({ mergeTags, syntax }),
        LogicMergeTagNode.configure({ syntax }),
      ],
    };
  },
});
</script>

<template>
  <div class="tpl-text-editor-wrapper tpl:relative">
    <ParagraphToolbar
      :editor="editor"
      :toolbar-position="toolbarPosition"
      :is-loading="isLoading"
      :merge-tag-enabled="mergeTagEnabled"
      @open-link-dialog="openLinkDialog"
      @add-merge-tag="handleAddMergeTag"
    />

    <RichTextEditorContent
      :editor="editor"
      :editor-content="EditorContent"
      :is-loading="isLoading"
      :init-error="initError"
      @retry="retry"
    />

    <RichTextLinkDialog
      :visible="showLinkDialog"
      :is-editing-link="editor?.isActive('link') ?? false"
      v-model:dialog-ref="linkDialogRef"
      v-model:link-url="linkUrl"
      @close="closeLinkDialog"
      @insert="insertLink"
      @remove="removeLink"
      @keydown="handleLinkKeydown"
    />
  </div>
</template>
