<script setup lang="ts">
import EmojiPickerDropdown from "./EmojiPickerDropdown.vue";
import ToolbarIconButton from "../toolbar/ToolbarIconButton.vue";
import ToolbarSeparator from "../toolbar/ToolbarSeparator.vue";
import ToolbarSelect from "../toolbar/ToolbarSelect.vue";
import { useI18n } from "../../composables";
import type { Editor } from "@tiptap/core";
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
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from "@lucide/vue";
import { inject } from "vue";
import {
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  FONTS_MANAGER_KEY,
  requireInject,
} from "../../keys";
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_HIGHLIGHT_COLOR,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
} from "../../constants/styleConstants";

const props = defineProps<{
  editor: Editor | null;
  toolbarPosition: { top: number; left: number };
  isLoading: boolean;
  canRequestMergeTag: boolean;
}>();

const emit = defineEmits<{
  (e: "open-link-dialog"): void;
  (e: "add-merge-tag"): void;
}>();

const themeStyles = inject(THEME_STYLES_KEY, null);
const tplUiTheme = inject(UI_THEME_KEY, null);
const fontsManager = requireInject(FONTS_MANAGER_KEY, "ParagraphToolbar");

const { t } = useI18n();

const fontFamilies = fontsManager.fonts;

function insertEmoji(emoji: string): void {
  props.editor?.chain().focus().insertContent(emoji).run();
}

function textStyleAttr(attr: string): string {
  return (props.editor?.getAttributes("textStyle")[attr] as string) || "";
}

function setFontFamily(family: string): void {
  const chain = props.editor?.chain().focus();
  if (family) chain?.setFontFamily(family).run();
  else chain?.unsetFontFamily().run();
}

function setFontSize(size: string): void {
  const chain = props.editor?.chain().focus();
  if (size) chain?.setFontSize(size).run();
  else chain?.unsetFontSize().run();
}

function setColor(color: string): void {
  const chain = props.editor?.chain().focus();
  if (color) chain?.setColor(color).run();
  else chain?.unsetColor().run();
}

function getCurrentLineHeight(): string {
  return (props.editor?.getAttributes("paragraph").lineHeight as string) || "";
}

function setLineHeight(value: string): void {
  const chain = props.editor?.chain().focus();
  if (value) chain?.setLineHeight(value).run();
  else chain?.unsetLineHeight().run();
}

function setLetterSpacing(value: string): void {
  const chain = props.editor?.chain().focus();
  if (value && value !== "normal") chain?.setLetterSpacing(value).run();
  else chain?.unsetLetterSpacing().run();
}

function getCurrentHighlight(): string {
  return (props.editor?.getAttributes("highlight").color as string) || "";
}

function setHighlight(color: string): void {
  const chain = props.editor?.chain().focus();
  if (color) chain?.setHighlight({ color }).run();
  else chain?.unsetHighlight().run();
}
</script>

<template>
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
          <ToolbarSelect
            :model-value="textStyleAttr('fontFamily')"
            :options="fontFamilies"
            :label="t.paragraphEditor.fontFamily"
            :placeholder="t.paragraphEditor.defaultFont"
            width-class="tpl:w-32"
            @update:model-value="setFontFamily"
          />
          <ToolbarSelect
            :model-value="textStyleAttr('fontSize')"
            :options="FONT_SIZE_OPTIONS"
            :label="t.paragraphEditor.fontSize"
            :placeholder="t.paragraphEditor.defaultSize"
            width-class="tpl:w-20"
            @update:model-value="setFontSize"
          />
          <ToolbarSeparator />
          <div class="tpl:relative">
            <input
              type="color"
              class="tpl:size-8 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-1"
              :value="textStyleAttr('color') || DEFAULT_TEXT_COLOR"
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
          <ToolbarSeparator />
          <ToolbarIconButton
            :icon="Bold"
            :label="t.paragraphEditor.bold"
            :active="editor.isActive('bold')"
            :stroke-width="2.5"
            @click="editor.chain().focus().toggleBold().run()"
          />
          <ToolbarIconButton
            :icon="Italic"
            :label="t.paragraphEditor.italic"
            :active="editor.isActive('italic')"
            @click="editor.chain().focus().toggleItalic().run()"
          />
          <ToolbarIconButton
            :icon="Underline"
            :label="t.paragraphEditor.underline"
            :active="editor.isActive('underline')"
            @click="editor.chain().focus().toggleUnderline().run()"
          />
          <ToolbarIconButton
            :icon="Strikethrough"
            :label="t.paragraphEditor.strikethrough"
            :active="editor.isActive('strike')"
            @click="editor.chain().focus().toggleStrike().run()"
          />
          <ToolbarSeparator />
          <ToolbarIconButton
            :icon="Subscript"
            :label="t.paragraphEditor.subscript"
            :active="editor.isActive('subscript')"
            @click="editor.chain().focus().toggleSubscript().run()"
          />
          <ToolbarIconButton
            :icon="Superscript"
            :label="t.paragraphEditor.superscript"
            :active="editor.isActive('superscript')"
            @click="editor.chain().focus().toggleSuperscript().run()"
          />
          <ToolbarSeparator />
          <ToolbarIconButton
            :icon="Link"
            :label="t.paragraphEditor.addLink"
            :active="editor.isActive('link')"
            @click="emit('open-link-dialog')"
          />
        </div>
        <!-- Row 2: Lists, Alignment, LH, LS, Clear, Emoji, Merge tags -->
        <div class="tpl:flex tpl:items-center tpl:gap-1">
          <ToolbarIconButton
            :icon="List"
            :label="t.paragraphEditor.bulletList"
            :active="editor.isActive('bulletList')"
            @click="editor.chain().focus().toggleBulletList().run()"
          />
          <ToolbarIconButton
            :icon="ListOrdered"
            :label="t.paragraphEditor.numberedList"
            :active="editor.isActive('orderedList')"
            @click="editor.chain().focus().toggleOrderedList().run()"
          />
          <ToolbarSeparator />
          <ToolbarIconButton
            :icon="AlignLeft"
            :label="t.paragraphEditor.alignLeft"
            :active="editor.isActive({ textAlign: 'left' })"
            @click="editor.chain().focus().setTextAlign('left').run()"
          />
          <ToolbarIconButton
            :icon="AlignCenter"
            :label="t.paragraphEditor.alignCenter"
            :active="editor.isActive({ textAlign: 'center' })"
            @click="editor.chain().focus().setTextAlign('center').run()"
          />
          <ToolbarIconButton
            :icon="AlignRight"
            :label="t.paragraphEditor.alignRight"
            :active="editor.isActive({ textAlign: 'right' })"
            @click="editor.chain().focus().setTextAlign('right').run()"
          />
          <ToolbarSeparator />
          <ToolbarSelect
            :model-value="getCurrentLineHeight()"
            :options="LINE_HEIGHT_OPTIONS"
            :label="t.paragraphEditor.lineHeight"
            placeholder="LH"
            width-class="tpl:w-16"
            @update:model-value="setLineHeight"
          />
          <ToolbarSelect
            :model-value="textStyleAttr('letterSpacing')"
            :options="LETTER_SPACING_OPTIONS"
            :label="t.paragraphEditor.letterSpacing"
            placeholder="LS"
            width-class="tpl:w-20"
            @update:model-value="setLetterSpacing"
          />
          <ToolbarSeparator />
          <ToolbarIconButton
            :icon="RemoveFormatting"
            :label="t.paragraphEditor.clearFormatting"
            @click="editor.chain().focus().clearNodes().unsetAllMarks().run()"
          />
          <ToolbarSeparator />
          <EmojiPickerDropdown @insert="insertEmoji" />
          <template v-if="canRequestMergeTag">
            <ToolbarSeparator />
            <button
              type="button"
              class="tpl:flex tpl:h-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-2.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
              :aria-label="t.mergeTag.add"
              :title="t.mergeTag.add"
              @click="emit('add-merge-tag')"
            >
              <ScanLine :size="16" :stroke-width="2" />
              {{ t.mergeTag.add }}
            </button>
          </template>
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
</template>
