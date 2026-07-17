<script setup lang="ts">
import EmojiPickerDropdown from "./EmojiPickerDropdown.vue";
import ToolbarIconButton from "../toolbar/ToolbarIconButton.vue";
import ToolbarSeparator from "../toolbar/ToolbarSeparator.vue";
import ToolbarSelect from "../toolbar/ToolbarSelect.vue";
import { useI18n } from "../../composables";
import { usePopoverRoot } from "../../composables/usePopoverRoot";
import type { Editor } from "@tiptap/core";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Braces,
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
  X,
} from "@lucide/vue";
import { computed, inject } from "vue";
import {
  EDITOR_KEY,
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  FONTS_MANAGER_KEY,
  MERGE_TAG_PICKER_KEY,
  LOGIC_TAG_PICKER_KEY,
  requireInject,
} from "../../keys";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
} from "../../constants/styleConstants";
import { resolveEffectiveTextColor } from "../../utils/richTextColor";

const props = defineProps<{
  editor: Editor | null;
  toolbarPosition: { top: number; left: number };
  isLoading: boolean;
  canRequestMergeTag: boolean;
  canInsertLogicTag: boolean;
}>();

const emit = defineEmits<{
  (e: "open-link-dialog"): void;
  (e: "add-merge-tag"): void;
  (e: "add-logic-tag"): void;
}>();

const themeStyles = inject(THEME_STYLES_KEY, null);
const tplUiTheme = inject(UI_THEME_KEY, null);
const fontsManager = requireInject(FONTS_MANAGER_KEY, "ParagraphToolbar");
const popoverRoot = usePopoverRoot();
// Picker may be null in non-editor contexts (e.g. isolated component tests).
// When it's provided AND open, hide the floating toolbar — leaving it
// visible behind the modal is visually noisy and the toolbar's Tailwind
// z-index utility doesn't compile reliably, so it can sometimes paint
// over the modal backdrop.
const picker = inject(MERGE_TAG_PICKER_KEY, null);
const logicPicker = inject(LOGIC_TAG_PICKER_KEY, null);
// Editor may be absent in isolated tests; used only to resolve the inherited
// document text color for the text-color swatch.
const editorReturn = inject(EDITOR_KEY, null);
// Hide the floating toolbar while either built-in picker modal is open, so it
// doesn't overlap the dialog.
const pickerIsOpen = computed(
  () => (picker?.isOpen.value ?? false) || (logicPicker?.isOpen.value ?? false),
);

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

// The color the current selection actually renders in: an explicit inline mark
// if present, else the inherited document text color. Drives the swatch so it
// shows the real color rather than a hard-coded default (issue #373).
function effectiveTextColor(): string {
  return resolveEffectiveTextColor(
    textStyleAttr("color"),
    editorReturn?.content.value.settings.textColor,
  );
}

// Whether the selection carries its own inline color overriding the document
// default. Gates the reset control that clears back to the inherited color.
function hasExplicitTextColor(): boolean {
  return textStyleAttr("color") !== "";
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
  <Teleport v-if="popoverRoot && !pickerIsOpen" :to="popoverRoot">
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
              :value="effectiveTextColor()"
              :aria-label="t.paragraphEditor.textColor"
              :title="t.paragraphEditor.textColor"
              @input="setColor(($event.target as HTMLInputElement).value)"
            />
            <button
              v-if="hasExplicitTextColor()"
              type="button"
              class="tpl:absolute tpl:-right-1 tpl:-top-1 tpl:flex tpl:size-4 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-dim)] tpl:shadow-sm tpl:transition-colors tpl:duration-150 hover:tpl:text-[var(--tpl-text)]"
              :aria-label="t.colorPicker.clear"
              :title="t.colorPicker.clear"
              @click="setColor('')"
            >
              <X :size="10" :stroke-width="2.5" />
            </button>
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
              :aria-label="t.mergeTag.insert"
              :title="t.mergeTag.insert"
              @click="emit('add-merge-tag')"
            >
              <ScanLine :size="16" :stroke-width="2" />
              {{ t.mergeTag.insertShort }}
            </button>
          </template>
          <template v-if="canInsertLogicTag">
            <ToolbarSeparator />
            <button
              type="button"
              class="tpl:flex tpl:h-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-2.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
              :aria-label="t.logicTag.insert"
              :title="t.logicTag.insert"
              data-testid="insert-logic-button"
              @click="emit('add-logic-tag')"
            >
              <Braces :size="16" :stroke-width="2" />
              {{ t.logicTag.insertShort }}
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
