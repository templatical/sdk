<script setup lang="ts">
import { useI18n } from "../../composables";
import { useRichTextEditor } from "../../composables/useRichTextEditor";
import { usePopoverRoot } from "../../composables/usePopoverRoot";
import type { TitleBlock as TitleBlockType } from "@templatical/types";
import {
  Bold,
  Braces,
  Italic,
  Link,
  LoaderCircle,
  ScanLine,
} from "@lucide/vue";
import { computed, inject } from "vue";
import {
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  MERGE_TAG_PICKER_KEY,
  LOGIC_TAG_PICKER_KEY,
} from "../../keys";
import RichTextLinkDialog from "./RichTextLinkDialog.vue";
import RichTextEditorContent from "./RichTextEditorContent.vue";

const props = defineProps<{
  block: TitleBlockType;
  toolbarPosition: { top: number; left: number };
}>();

const emit = defineEmits<{
  (e: "done"): void;
}>();

const themeStyles = inject(THEME_STYLES_KEY, null);
const tplUiTheme = inject(UI_THEME_KEY, null);
const popoverRoot = usePopoverRoot();
// Hide the floating toolbar while either built-in picker modal is open — see
// ParagraphToolbar.vue for the same rationale.
const picker = inject(MERGE_TAG_PICKER_KEY, null);
const logicPicker = inject(LOGIC_TAG_PICKER_KEY, null);
const pickerIsOpen = computed(
  () => (picker?.isOpen.value ?? false) || (logicPicker?.isOpen.value ?? false),
);

const { t } = useI18n();

const {
  editor,
  EditorContent,
  isLoading,
  initError,
  retry,
  showLinkDialog,
  linkUrl,
  linkDialogRef,
  canRequestMergeTag,
  canInsertLogicTag,
  openLinkDialog,
  insertLink,
  removeLink,
  closeLinkDialog,
  handleLinkKeydown,
  handleAddMergeTag,
  handleAddLogicTag,
} = useRichTextEditor({
  blockId: () => props.block.id,
  blockContent: () => props.block.content,
  onDone: () => emit("done"),
  editorName: "TitleEditor",
  async loadExtensions({
    mergeTags,
    syntax,
    triggerChar,
    autocompleteEnabled,
    suggestionEmptyText,
  }) {
    const [
      { Editor: TiptapEditor, EditorContent: EC },
      { default: StarterKit },
      { default: LinkExt },
      { MergeTagNode, MergeTagSuggestion, LogicMergeTagNode },
    ] = await Promise.all([
      import("@tiptap/vue-3"),
      import("@tiptap/starter-kit"),
      import("@tiptap/extension-link"),
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
          bulletList: false,
          orderedList: false,
          listItem: false,
          strike: false,
          // StarterKit bundles @tiptap/extension-link (openOnClick: true).
          // Disable it so the LinkExt below (openOnClick: false) is the only
          // link extension — otherwise clicking a link while editing opens it.
          link: false,
        }),
        LinkExt.configure({
          openOnClick: false,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }),
        MergeTagNode.configure({ mergeTags, syntax }),
        LogicMergeTagNode.configure({ syntax }),
        ...(autocompleteEnabled && triggerChar && mergeTags.length > 0
          ? [
              MergeTagSuggestion.configure({
                mergeTags,
                char: triggerChar,
                emptyText: suggestionEmptyText,
                popoverRoot,
              }),
            ]
          : []),
      ],
    };
  },
});
</script>

<template>
  <div class="tpl-text-editor-wrapper tpl:relative">
    <Teleport v-if="popoverRoot && !pickerIsOpen" :to="popoverRoot">
      <div
        :data-tpl-theme="tplUiTheme"
        role="toolbar"
        :aria-label="t.titleEditor.toolbar"
        class="tpl tpl-text-toolbar tpl:fixed tpl:z-popover tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:shadow-lg"
        :style="{
          ...themeStyles,
          top: `${toolbarPosition.top}px`,
          left: `${toolbarPosition.left}px`,
          transform: 'translateY(-100%)',
        }"
      >
        <template v-if="!isLoading && editor">
          <!-- Bold -->
          <button
            type="button"
            class="tpl-text-toolbar-btn"
            :class="{
              'tpl-text-toolbar-btn--active': editor?.isActive('bold'),
            }"
            :aria-label="t.titleEditor.bold"
            :title="t.titleEditor.bold"
            @click="editor?.chain().focus().toggleBold().run()"
          >
            <Bold :size="16" :stroke-width="2.5" />
          </button>
          <!-- Italic -->
          <button
            type="button"
            class="tpl-text-toolbar-btn"
            :class="{
              'tpl-text-toolbar-btn--active': editor?.isActive('italic'),
            }"
            :aria-label="t.titleEditor.italic"
            :title="t.titleEditor.italic"
            @click="editor?.chain().focus().toggleItalic().run()"
          >
            <Italic :size="16" :stroke-width="2" />
          </button>
          <span
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
            aria-hidden="true"
          ></span>
          <!-- Link -->
          <button
            type="button"
            class="tpl-text-toolbar-btn"
            :class="{
              'tpl-text-toolbar-btn--active': editor?.isActive('link'),
            }"
            :aria-label="t.titleEditor.addLink"
            :title="t.titleEditor.addLink"
            @click="openLinkDialog"
          >
            <Link :size="16" :stroke-width="2" />
          </button>
          <!-- Add Merge Tag -->
          <span
            v-if="canRequestMergeTag"
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
          ></span>
          <button
            v-if="canRequestMergeTag"
            type="button"
            class="tpl:flex tpl:h-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-2.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :aria-label="t.mergeTag.insert"
            :title="t.mergeTag.insert"
            @click="handleAddMergeTag"
          >
            <ScanLine :size="16" :stroke-width="2" />
            {{ t.mergeTag.insertShort }}
          </button>
          <!-- Insert Logic -->
          <span
            v-if="canInsertLogicTag"
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
          ></span>
          <button
            v-if="canInsertLogicTag"
            type="button"
            class="tpl:flex tpl:h-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-2.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :aria-label="t.logicTag.insert"
            :title="t.logicTag.insert"
            data-testid="insert-logic-button"
            @click="handleAddLogicTag"
          >
            <Braces :size="16" :stroke-width="2" />
            {{ t.logicTag.insertShort }}
          </button>
        </template>
        <template v-else>
          <div
            class="tpl:flex tpl:items-center tpl:gap-2 tpl:px-2 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
          >
            <LoaderCircle class="tpl-spinner" :size="14" :stroke-width="2" />
            {{ t.errors.editorLoading }}
          </div>
        </template>
      </div>
    </Teleport>

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
