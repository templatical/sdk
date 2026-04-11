<script setup lang="ts">
import EmojiPickerDropdown from "./EmojiPickerDropdown.vue";
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
  mergeTagEnabled: boolean;
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

function getCurrentFontFamily(): string {
  return (props.editor?.getAttributes("textStyle").fontFamily as string) || "";
}

function getCurrentFontSize(): string {
  return (props.editor?.getAttributes("textStyle").fontSize as string) || "";
}

function getCurrentColor(): string {
  return (props.editor?.getAttributes("textStyle").color as string) || "";
}

function setFontFamily(family: string): void {
  if (family) {
    props.editor?.chain().focus().setFontFamily(family).run();
  } else {
    props.editor?.chain().focus().unsetFontFamily().run();
  }
}

function setFontSize(size: string): void {
  if (size) {
    props.editor?.chain().focus().setFontSize(size).run();
  } else {
    props.editor?.chain().focus().unsetFontSize().run();
  }
}

function setColor(color: string): void {
  if (color) {
    props.editor?.chain().focus().setColor(color).run();
  } else {
    props.editor?.chain().focus().unsetColor().run();
  }
}

function getCurrentLineHeight(): string {
  return (props.editor?.getAttributes("paragraph").lineHeight as string) || "";
}

function setLineHeight(value: string): void {
  if (value) {
    props.editor?.chain().focus().setLineHeight(value).run();
  } else {
    props.editor?.chain().focus().unsetLineHeight().run();
  }
}

function getCurrentLetterSpacing(): string {
  return (
    (props.editor?.getAttributes("textStyle").letterSpacing as string) || ""
  );
}

function setLetterSpacing(value: string): void {
  if (value && value !== "normal") {
    props.editor?.chain().focus().setLetterSpacing(value).run();
  } else {
    props.editor?.chain().focus().unsetLetterSpacing().run();
  }
}

function getCurrentHighlight(): string {
  return (props.editor?.getAttributes("highlight").color as string) || "";
}

function setHighlight(color: string): void {
  if (color) {
    props.editor?.chain().focus().setHighlight({ color }).run();
  } else {
    props.editor?.chain().focus().unsetHighlight().run();
  }
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
          <select
            class="tpl:h-8 tpl:w-32 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none"
            :value="getCurrentFontFamily()"
            :aria-label="t.paragraphEditor.fontFamily"
            :title="t.paragraphEditor.fontFamily"
            @change="setFontFamily(($event.target as HTMLSelectElement).value)"
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
            <option v-for="size in FONT_SIZE_OPTIONS" :key="size" :value="size">
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
            @click="emit('open-link-dialog')"
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
            @change="setLineHeight(($event.target as HTMLSelectElement).value)"
          >
            <option value="">LH</option>
            <option v-for="lh in LINE_HEIGHT_OPTIONS" :key="lh" :value="lh">
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
              v-for="ls in LETTER_SPACING_OPTIONS"
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
            @click="editor?.chain().focus().clearNodes().unsetAllMarks().run()"
          >
            <RemoveFormatting :size="16" :stroke-width="2" />
          </button>
          <!-- Emoji Picker -->
          <span
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
            aria-hidden="true"
          ></span>
          <EmojiPickerDropdown @insert="insertEmoji" />
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
            @click="emit('add-merge-tag')"
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
</template>
