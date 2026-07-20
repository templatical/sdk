<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
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

// When the selection is a link, the color control operates on the link itself
// (its `color` attribute → inline on the `<a>`) so the link's text and underline
// stay in sync; otherwise it applies a plain inline text-color mark.
function isLinkSelection(): boolean {
  return props.editor?.isActive("link") ?? false;
}

function linkColorAttr(): string {
  return (props.editor?.getAttributes("link").color as string) || "";
}

// Set (or clear, when empty) the color of the current selection. On a link the
// whole link is recolored (extendMarkRange) so it doesn't split into segments.
function setColor(color: string): void {
  const chain = props.editor?.chain().focus();
  if (!chain) return;
  if (isLinkSelection()) {
    chain.extendMarkRange("link").updateAttributes("link", {
      color: color || null,
    });
    // A per-link color takes absolute priority over any inner text-color: strip
    // the inline text color on the link range so the `<a>` color alone drives
    // the glyphs and the underline (mirrors useRichTextLinkDialog.insertLink).
    // Only when setting a color — clearing leaves the text color untouched.
    if (color) chain.unsetColor();
    chain.run();
  } else if (color) {
    // A text color applied over a selection that includes a link unifies the
    // link with it: update the link's own color so the `<a>` (which paints the
    // underline and is what the dialog/toolbar read) matches the recolored
    // glyphs. A no-op on a selection with no link. Mirror of the link branch
    // above — either way a link never ends up with a text color fighting its
    // own color.
    chain.setColor(color).updateAttributes("link", { color }).run();
  } else {
    chain.unsetColor().run();
  }
}

// The color the current selection actually renders in — a link's own color (else
// the effective document link color: link color, then text color), or for plain
// text the inline mark else the document text color. Keeps the swatch truthful
// rather than showing a hard-coded default (issue #373 / per-link color).
function effectiveTextColor(): string {
  const settings = editorReturn?.content.value.settings;
  if (isLinkSelection()) {
    return resolveEffectiveTextColor(
      linkColorAttr(),
      settings?.linkColor || settings?.textColor,
    );
  }
  return resolveEffectiveTextColor(textStyleAttr("color"), settings?.textColor);
}

// The selection's own explicit color: a link's color when on a link, else the
// inline text-color mark. May be "" when the selection only inherits its color
// — that drives the swatch's set/unset state, while `effectiveTextColor()`
// seeds the wheel so it still opens on the real rendered color.
function explicitTextColor(): string {
  return isLinkSelection() ? linkColorAttr() : textStyleAttr("color");
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
      class="tpl tpl-text-toolbar tpl:absolute tpl:z-popover tpl:flex tpl:gap-1 tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:shadow-lg"
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
          <ColorPicker
            swatch-only
            size="sm"
            data-testid="text-color-picker"
            :model-value="explicitTextColor()"
            :seed-color="effectiveTextColor()"
            :aria-label="t.paragraphEditor.textColor"
            @update:model-value="setColor"
          />
          <ColorPicker
            swatch-only
            size="sm"
            data-testid="highlight-color-picker"
            :model-value="getCurrentHighlight()"
            :seed-color="DEFAULT_HIGHLIGHT_COLOR"
            :aria-label="t.paragraphEditor.highlightColor"
            @update:model-value="setHighlight"
          />
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
