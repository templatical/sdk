<script setup lang="ts">
import { useEmoji, useI18n } from "../../composables";
import { useRichTextEditor } from "../../composables/useRichTextEditor";
import type { ParagraphBlock as ParagraphBlockType } from "@templatical/types";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  RemoveFormatting,
  ScanLine,
  Smile,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from "@lucide/vue";
import { inject } from "vue";
import { THEME_STYLES_KEY, UI_THEME_KEY, FONTS_MANAGER_KEY } from "../../keys";
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_HIGHLIGHT_COLOR,
} from "../../constants/styleConstants";
import RichTextLinkDialog from "./RichTextLinkDialog.vue";
import RichTextEditorContent from "./RichTextEditorContent.vue";

const props = defineProps<{
  block: ParagraphBlockType;
  toolbarPosition: { top: number; left: number };
}>();

const emit = defineEmits<{
  (e: "done"): void;
}>();

const themeStyles = inject(THEME_STYLES_KEY);
const tplUiTheme = inject(UI_THEME_KEY);
const fontsManager = inject(FONTS_MANAGER_KEY)!;

const {
  categories: emojiCategories,
  isOpen: showEmojiPicker,
  toggle: toggleEmojiPicker,
  close: closeEmojiPicker,
} = useEmoji();

const { t } = useI18n();

function insertEmoji(emoji: string): void {
  editor.value?.chain().focus().insertContent(emoji).run();
  closeEmojiPicker();
}

const fontFamilies = fontsManager.fonts;

const fontSizes = [
  "10px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "48px",
  "64px",
];

const lineHeights = ["1", "1.2", "1.4", "1.5", "1.6", "1.8", "2", "2.5"];

const letterSpacings = [
  { label: "Normal", value: "normal" },
  { label: "-0.5px", value: "-0.5px" },
  { label: "0.5px", value: "0.5px" },
  { label: "1px", value: "1px" },
  { label: "1.5px", value: "1.5px" },
  { label: "2px", value: "2px" },
  { label: "3px", value: "3px" },
];

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
  onClickOutsideSideEffect(target) {
    if (showEmojiPicker.value && !target.closest(".tpl-emoji-picker")) {
      closeEmojiPicker();
    }
  },
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

function getCurrentFontFamily(): string {
  return (editor.value?.getAttributes("textStyle").fontFamily as string) || "";
}

function getCurrentFontSize(): string {
  return (editor.value?.getAttributes("textStyle").fontSize as string) || "";
}

function getCurrentColor(): string {
  return (editor.value?.getAttributes("textStyle").color as string) || "";
}

function setFontFamily(family: string): void {
  if (family) {
    editor.value?.chain().focus().setFontFamily(family).run();
  } else {
    editor.value?.chain().focus().unsetFontFamily().run();
  }
}

function setFontSize(size: string): void {
  if (size) {
    editor.value?.chain().focus().setFontSize(size).run();
  } else {
    editor.value?.chain().focus().unsetFontSize().run();
  }
}

function setColor(color: string): void {
  if (color) {
    editor.value?.chain().focus().setColor(color).run();
  } else {
    editor.value?.chain().focus().unsetColor().run();
  }
}

function getCurrentLineHeight(): string {
  return (editor.value?.getAttributes("paragraph").lineHeight as string) || "";
}

function setLineHeight(value: string): void {
  if (value) {
    editor.value?.chain().focus().setLineHeight(value).run();
  } else {
    editor.value?.chain().focus().unsetLineHeight().run();
  }
}

function getCurrentLetterSpacing(): string {
  return (
    (editor.value?.getAttributes("textStyle").letterSpacing as string) || ""
  );
}

function setLetterSpacing(value: string): void {
  if (value && value !== "normal") {
    editor.value?.chain().focus().setLetterSpacing(value).run();
  } else {
    editor.value?.chain().focus().unsetLetterSpacing().run();
  }
}

function getCurrentHighlight(): string {
  return (editor.value?.getAttributes("highlight").color as string) || "";
}

function setHighlight(color: string): void {
  if (color) {
    editor.value?.chain().focus().setHighlight({ color }).run();
  } else {
    editor.value?.chain().focus().unsetHighlight().run();
  }
}
</script>

<template>
  <div class="tpl-text-editor-wrapper tpl:relative">
    <Teleport to="body">
      <div
        :data-tpl-theme="tplUiTheme"
        role="toolbar"
        :aria-label="t.paragraphEditor.toolbar"
        class="tpl tpl-text-toolbar tpl:fixed tpl:z-popover tpl:flex tpl:gap-1 tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:shadow-lg"
        :style="{
          ...themeStyles,
          top: `${toolbarPosition.top}px`,
          left: `${toolbarPosition.left}px`,
          transform: 'translateY(-100%)',
          flexDirection: 'column',
        }"
      >
        <template v-if="!isLoading && editor">
          <!-- Row 1: Font family, Font size, Text color, Bold/Italic/Underline/Strikethrough -->
          <div class="tpl:flex tpl:items-center tpl:gap-1">
            <select
              class="tpl:h-8 tpl:w-32 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none"
              :value="getCurrentFontFamily()"
              :aria-label="t.paragraphEditor.fontFamily"
              :title="t.paragraphEditor.fontFamily"
              @change="
                setFontFamily(($event.target as HTMLSelectElement).value)
              "
            >
              <option value="">{{ t.paragraphEditor.defaultFont }}</option>
              <option
                v-for="font in fontFamilies"
                :key="font.value"
                :value="font.value"
              >
                {{ font.label }}
              </option>
            </select>
            <select
              class="tpl:h-8 tpl:w-20 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none"
              :value="getCurrentFontSize()"
              :aria-label="t.paragraphEditor.fontSize"
              :title="t.paragraphEditor.fontSize"
              @change="setFontSize(($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ t.paragraphEditor.defaultSize }}</option>
              <option v-for="size in fontSizes" :key="size" :value="size">
                {{ size }}
              </option>
            </select>
            <span
              class="tpl:mx-1 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <div class="tpl:relative">
              <input
                type="color"
                class="tpl:size-8 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-1"
                :value="getCurrentColor() || DEFAULT_TEXT_COLOR"
                :aria-label="t.paragraphEditor.textColor"
                :title="t.paragraphEditor.textColor"
                @input="setColor(($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="tpl:relative">
              <input
                type="color"
                class="tpl:size-8 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:p-1"
                :style="{
                  backgroundColor: getCurrentHighlight() || 'var(--tpl-bg)',
                }"
                :value="getCurrentHighlight() || DEFAULT_HIGHLIGHT_COLOR"
                :aria-label="t.paragraphEditor.highlightColor"
                :title="t.paragraphEditor.highlightColor"
                @input="setHighlight(($event.target as HTMLInputElement).value)"
              />
            </div>
            <span
              class="tpl:mx-1 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <!-- Bold/Italic/Underline/Strikethrough -->
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('bold'),
              }"
              :aria-label="t.paragraphEditor.bold"
              :title="t.paragraphEditor.bold"
              @click="editor?.chain().focus().toggleBold().run()"
            >
              <Bold :size="16" :stroke-width="2.5" />
            </button>
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('italic'),
              }"
              :aria-label="t.paragraphEditor.italic"
              :title="t.paragraphEditor.italic"
              @click="editor?.chain().focus().toggleItalic().run()"
            >
              <Italic :size="16" :stroke-width="2" />
            </button>
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('underline'),
              }"
              :aria-label="t.paragraphEditor.underline"
              :title="t.paragraphEditor.underline"
              @click="editor?.chain().focus().toggleUnderline().run()"
            >
              <Underline :size="16" :stroke-width="2" />
            </button>
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('strike'),
              }"
              :aria-label="t.paragraphEditor.strikethrough"
              :title="t.paragraphEditor.strikethrough"
              @click="editor?.chain().focus().toggleStrike().run()"
            >
              <Strikethrough :size="16" :stroke-width="2" />
            </button>
            <span
              class="tpl:mx-1 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <!-- Subscript/Superscript -->
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('subscript'),
              }"
              :aria-label="t.paragraphEditor.subscript"
              :title="t.paragraphEditor.subscript"
              @click="editor?.chain().focus().toggleSubscript().run()"
            >
              <Subscript :size="16" :stroke-width="2" />
            </button>
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('superscript'),
              }"
              :aria-label="t.paragraphEditor.superscript"
              :title="t.paragraphEditor.superscript"
              @click="editor?.chain().focus().toggleSuperscript().run()"
            >
              <Superscript :size="16" :stroke-width="2" />
            </button>
            <span
              class="tpl:mx-1 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <!-- Link -->
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('link'),
              }"
              :aria-label="t.paragraphEditor.addLink"
              :title="t.paragraphEditor.addLink"
              @click="openLinkDialog"
            >
              <Link :size="16" :stroke-width="2" />
            </button>
          </div>
          <!-- Row 2: Lists, Alignment, LH, LS, Clear, Emoji, Merge tags -->
          <div class="tpl:flex tpl:items-center tpl:gap-1">
            <!-- Lists -->
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('bulletList'),
              }"
              :aria-label="t.paragraphEditor.bulletList"
              :title="t.paragraphEditor.bulletList"
              @click="editor?.chain().focus().toggleBulletList().run()"
            >
              <List :size="16" :stroke-width="2" />
            </button>
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive('orderedList'),
              }"
              :aria-label="t.paragraphEditor.numberedList"
              :title="t.paragraphEditor.numberedList"
              @click="editor?.chain().focus().toggleOrderedList().run()"
            >
              <ListOrdered :size="16" :stroke-width="2" />
            </button>
            <span
              class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <!-- Alignment -->
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive({
                  textAlign: 'left',
                }),
              }"
              :aria-label="t.paragraphEditor.alignLeft"
              :title="t.paragraphEditor.alignLeft"
              @click="editor?.chain().focus().setTextAlign('left').run()"
            >
              <AlignLeft :size="16" :stroke-width="2" />
            </button>
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive({
                  textAlign: 'center',
                }),
              }"
              :aria-label="t.paragraphEditor.alignCenter"
              :title="t.paragraphEditor.alignCenter"
              @click="editor?.chain().focus().setTextAlign('center').run()"
            >
              <AlignCenter :size="16" :stroke-width="2" />
            </button>
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :class="{
                'tpl-text-toolbar-btn--active': editor?.isActive({
                  textAlign: 'right',
                }),
              }"
              :aria-label="t.paragraphEditor.alignRight"
              :title="t.paragraphEditor.alignRight"
              @click="editor?.chain().focus().setTextAlign('right').run()"
            >
              <AlignRight :size="16" :stroke-width="2" />
            </button>
            <span
              class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <!-- Line Height -->
            <select
              class="tpl:h-8 tpl:w-16 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-1 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none"
              :value="getCurrentLineHeight()"
              :title="t.paragraphEditor.lineHeight"
              @change="
                setLineHeight(($event.target as HTMLSelectElement).value)
              "
            >
              <option value="">LH</option>
              <option v-for="lh in lineHeights" :key="lh" :value="lh">
                {{ lh }}
              </option>
            </select>
            <!-- Letter Spacing -->
            <select
              class="tpl:h-8 tpl:w-20 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-1 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none"
              :value="getCurrentLetterSpacing()"
              :title="t.paragraphEditor.letterSpacing"
              @change="
                setLetterSpacing(($event.target as HTMLSelectElement).value)
              "
            >
              <option value="">LS</option>
              <option
                v-for="ls in letterSpacings"
                :key="ls.value"
                :value="ls.value"
              >
                {{ ls.label }}
              </option>
            </select>
            <span
              class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <!-- Clear Formatting -->
            <button
              type="button"
              class="tpl-text-toolbar-btn"
              :aria-label="t.paragraphEditor.clearFormatting"
              :title="t.paragraphEditor.clearFormatting"
              @click="
                editor?.chain().focus().clearNodes().unsetAllMarks().run()
              "
            >
              <RemoveFormatting :size="16" :stroke-width="2" />
            </button>
            <!-- Emoji Picker -->
            <span
              class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
              aria-hidden="true"
            ></span>
            <div class="tpl:relative">
              <button
                type="button"
                class="tpl-text-toolbar-btn"
                :class="{
                  'tpl-text-toolbar-btn--active': showEmojiPicker,
                }"
                :aria-label="t.paragraphEditor.insertEmoji"
                :title="t.paragraphEditor.insertEmoji"
                @click="toggleEmojiPicker"
              >
                <Smile :size="16" :stroke-width="2" />
              </button>
              <div
                v-if="showEmojiPicker"
                class="tpl-emoji-picker tpl:absolute tpl:top-full tpl:left-0 tpl:z-10 tpl:mt-2 tpl:w-72 tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:shadow-lg"
              >
                <div
                  v-for="category in emojiCategories"
                  :key="category.key"
                  class="tpl:mb-2 tpl:last:mb-0"
                >
                  <div
                    class="tpl:mb-1.5 tpl:text-[10px] tpl:font-medium tpl:tracking-wide tpl:text-[var(--tpl-text-muted)] tpl:uppercase"
                  >
                    {{ t.emoji[category.key] }}
                  </div>
                  <div class="tpl:grid tpl:grid-cols-10 tpl:gap-0.5">
                    <button
                      v-for="emoji in category.emojis"
                      :key="emoji"
                      type="button"
                      class="tpl:flex tpl:size-6 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:text-base tpl:transition-all tpl:duration-100 tpl:hover:scale-125 tpl:hover:bg-[var(--tpl-bg-active)]"
                      @click="insertEmoji(emoji)"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <!-- Add Merge Tag -->
            <span
              v-if="mergeTagEnabled"
              class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
            ></span>
            <button
              v-if="mergeTagEnabled"
              type="button"
              class="tpl:flex tpl:h-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-2.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
              :aria-label="t.mergeTag.add"
              :title="t.mergeTag.add"
              @click="handleAddMergeTag"
            >
              <ScanLine :size="16" :stroke-width="2" />
              {{ t.mergeTag.add }}
            </button>
          </div>
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
