<script setup lang="ts">
import { useEmoji, useFocusTrap, useI18n, useMergeTag } from "../../composables";
import type { UseEditorReturn } from "@templatical/core";
import type { TextBlock as TextBlockType } from "@templatical/types";
import type { Editor } from "@tiptap/core";
import type { EditorContent as EditorContentComponent } from "@tiptap/vue-3";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  RemoveFormatting,
  ScanLine,
  Smile,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  X,
} from "lucide-vue-next";
import { useEventListener } from "@vueuse/core";
import {
  inject,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";

const props = defineProps<{
  block: TextBlockType;
  toolbarPosition: { top: number; left: number };
}>();

const emit = defineEmits<{
  (e: "done"): void;
}>();

const emailEditor = inject<UseEditorReturn>("editor");
const themeStyles = inject<ComputedRef<Record<string, string>>>("themeStyles");
const tplUiTheme = inject<Ref<"light" | "dark">>("tplUiTheme");
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
let focusTimeout: ReturnType<typeof setTimeout> | null = null;

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

// Lazy-loaded editor instance - use Editor class directly instead of useEditor composable
// because useEditor must be called synchronously during component setup
const editor = shallowRef<Editor | null>(null);
const EditorContent = shallowRef<typeof EditorContentComponent | null>(null);
const isLoading = ref(true);

async function initEditor(): Promise<void> {
  try {
    const [
      { Editor: TiptapEditor },
      { EditorContent: EC },
      { default: StarterKit },
      { default: Link },
      { default: Underline },
      { default: Subscript },
      { default: Superscript },
      { default: TextAlign },
      { MergeTagNode, LogicMergeTagNode },
    ] = await Promise.all([
      import("@tiptap/core"),
      import("@tiptap/vue-3"),
      import("@tiptap/starter-kit"),
      import("@tiptap/extension-link"),
      import("@tiptap/extension-underline"),
      import("@tiptap/extension-subscript"),
      import("@tiptap/extension-superscript"),
      import("@tiptap/extension-text-align"),
      import("../../extensions"),
    ]);

    EditorContent.value = EC;

    // Build extensions array
    const extensions = [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Subscript,
      Superscript,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      TextAlign.configure({
        types: ["paragraph", "heading"],
      }),
      MergeTagNode.configure({
        mergeTags,
        syntax,
      }),
      LogicMergeTagNode.configure({
        syntax,
      }),
    ];

    // Deduplicate extensions by name (keep last occurrence) to prevent bundler-related duplicates
    const seen = new Map<string, number>();
    extensions.forEach((ext, i) => seen.set(ext.name, i));
    const uniqueExtensions = extensions.filter(
      (ext, i) => seen.get(ext.name) === i,
    );

    // Use Editor class directly instead of useEditor composable
    // useEditor must be called synchronously during setup, but we're in an async function
    editor.value = new TiptapEditor({
      extensions: uniqueExtensions,
      content: props.block.content,
      editable: true,
      onUpdate: ({ editor: e }) => {
        if (emailEditor) {
          emailEditor.updateBlock(props.block.id, {
            content: e.getHTML(),
          });
        }
      },
    });

    isLoading.value = false;

    // Focus after init
    focusTimeout = setTimeout(() => {
      editor.value?.commands.focus("end");
      focusTimeout = null;
    }, 0);
  } catch (error) {
    console.error("[TextEditor] Failed to initialize TipTap editor:", error);
    isLoading.value = false;
  }
}

initEditor();

watch(
  () => props.block.content,
  (newContent) => {
    if (editor.value) {
      const currentContent = editor.value.getHTML();
      if (currentContent !== newContent) {
        editor.value.commands.setContent(newContent, false);
      }
    }
  },
);

function handleClickOutside(event: MouseEvent): void {
  if (isRequestingMergeTag.value) return;

  const target = event.target as HTMLElement;

  // Close emoji picker if clicking outside of it
  if (showEmojiPicker.value && !target.closest(".tpl-emoji-picker")) {
    closeEmojiPicker();
  }

  if (
    target.closest(".tpl-text-editor-wrapper") ||
    target.closest(".tpl-text-toolbar") ||
    target.closest(".tpl-link-dialog")
  ) {
    return;
  }

  emit("done");
}

useEventListener(document, "mousedown", handleClickOutside);

onBeforeUnmount(() => {
  if (focusTimeout) {
    clearTimeout(focusTimeout);
    focusTimeout = null;
  }
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
</script>

<template>
  <div class="tpl-text-editor-wrapper tpl:relative">
    <Teleport to="body">
      <div
        :data-tpl-theme="tplUiTheme"
        role="toolbar"
        :aria-label="t.textEditor.toolbar"
        class="tpl tpl-text-toolbar tpl:fixed tpl:z-popover tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:shadow-lg"
        :style="{
          ...themeStyles,
          top: `${toolbarPosition.top}px`,
          left: `${toolbarPosition.left}px`,
          transform: 'translateY(-100%)',
        }"
      >
        <template v-if="!isLoading && editor">
          <!-- Text Formatting -->
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('bold'),
            }"
            :aria-label="t.textEditor.bold"
            :title="t.textEditor.bold"
            @click="editor?.chain().focus().toggleBold().run()"
          >
            <Bold :size="16" :stroke-width="2.5" />
          </button>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('italic'),
            }"
            :aria-label="t.textEditor.italic"
            :title="t.textEditor.italic"
            @click="editor?.chain().focus().toggleItalic().run()"
          >
            <Italic :size="16" :stroke-width="2" />
          </button>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('underline'),
            }"
            :aria-label="t.textEditor.underline"
            :title="t.textEditor.underline"
            @click="editor?.chain().focus().toggleUnderline().run()"
          >
            <Underline :size="16" :stroke-width="2" />
          </button>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('strike'),
            }"
            :aria-label="t.textEditor.strikethrough"
            :title="t.textEditor.strikethrough"
            @click="editor?.chain().focus().toggleStrike().run()"
          >
            <Strikethrough :size="16" :stroke-width="2" />
          </button>
          <span
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
            aria-hidden="true"
          ></span>
          <!-- Subscript/Superscript -->
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('subscript'),
            }"
            :aria-label="t.textEditor.subscript"
            :title="t.textEditor.subscript"
            @click="editor?.chain().focus().toggleSubscript().run()"
          >
            <Subscript :size="16" :stroke-width="2" />
          </button>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('superscript'),
            }"
            :aria-label="t.textEditor.superscript"
            :title="t.textEditor.superscript"
            @click="editor?.chain().focus().toggleSuperscript().run()"
          >
            <Superscript :size="16" :stroke-width="2" />
          </button>
          <span
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
            aria-hidden="true"
          ></span>
          <!-- Link -->
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('link'),
            }"
            :aria-label="t.textEditor.addLink"
            :title="t.textEditor.addLink"
            @click="openLinkDialog"
          >
            <Link :size="16" :stroke-width="2" />
          </button>
          <span
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
            aria-hidden="true"
          ></span>
          <!-- Lists -->
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('bulletList'),
            }"
            :aria-label="t.textEditor.bulletList"
            :title="t.textEditor.bulletList"
            @click="editor?.chain().focus().toggleBulletList().run()"
          >
            <List :size="16" :stroke-width="2" />
          </button>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('orderedList'),
            }"
            :aria-label="t.textEditor.numberedList"
            :title="t.textEditor.numberedList"
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
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]': editor?.isActive({
                textAlign: 'left',
              }),
            }"
            :aria-label="t.textEditor.alignLeft"
            :title="t.textEditor.alignLeft"
            @click="editor?.chain().focus().setTextAlign('left').run()"
          >
            <AlignLeft :size="16" :stroke-width="2" />
          </button>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]': editor?.isActive({
                textAlign: 'center',
              }),
            }"
            :aria-label="t.textEditor.alignCenter"
            :title="t.textEditor.alignCenter"
            @click="editor?.chain().focus().setTextAlign('center').run()"
          >
            <AlignCenter :size="16" :stroke-width="2" />
          </button>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]': editor?.isActive({
                textAlign: 'right',
              }),
            }"
            :aria-label="t.textEditor.alignRight"
            :title="t.textEditor.alignRight"
            @click="editor?.chain().focus().setTextAlign('right').run()"
          >
            <AlignRight :size="16" :stroke-width="2" />
          </button>
          <!-- Clear Formatting -->
          <span
            class="tpl:mx-1.5 tpl:h-6 tpl:w-px tpl:bg-[var(--tpl-border)]"
            aria-hidden="true"
          ></span>
          <button
            type="button"
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :aria-label="t.textEditor.clearFormatting"
            :title="t.textEditor.clearFormatting"
            @click="editor?.chain().focus().clearNodes().unsetAllMarks().run()"
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
              class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
              :class="{
                'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]': showEmojiPicker,
              }"
              :aria-label="t.textEditor.insertEmoji"
              :title="t.textEditor.insertEmoji"
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
        </template>
        <template v-else>
          <div
            class="tpl:flex tpl:items-center tpl:gap-2 tpl:px-2 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
          >
            <Loader2 class="tpl-spinner" :size="14" :stroke-width="2" />
            Loading editor...
          </div>
        </template>
      </div>
    </Teleport>

    <div
      v-if="isLoading"
      class="tpl-text-editable tpl:min-h-[1.5em] tpl:rounded tpl:border tpl:border-dashed tpl:border-[var(--tpl-primary)] tpl:p-2"
    >
      <div class="tpl:animate-pulse tpl:text-[var(--tpl-text-dim)]">
        Loading...
      </div>
    </div>
    <component
      :is="EditorContent"
      v-else-if="EditorContent && editor"
      :editor="editor as any"
      class="tpl-text-editable tpl:min-h-[1.5em] tpl:rounded tpl:border tpl:border-dashed tpl:border-[var(--tpl-primary)] tpl:p-2"
    />

    <Teleport to="body">
      <div
        v-if="showLinkDialog"
        :data-tpl-theme="tplUiTheme"
        class="tpl tpl-link-dialog tpl:fixed tpl:inset-0 tpl:z-modal tpl:flex tpl:items-center tpl:justify-center"
        :style="themeStyles"
        @click.self="closeLinkDialog"
      >
        <div
          ref="linkDialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-link-dialog-title"
          class="tpl:w-[400px] tpl:overflow-hidden tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:shadow-lg"
        >
          <div
            class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-5 tpl:py-4"
          >
            <h4
              id="tpl-link-dialog-title"
              class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
            >
              {{
                editor?.isActive("link")
                  ? t.linkDialog.editLink
                  : t.linkDialog.insertLink
              }}
            </h4>
            <button
              type="button"
              :aria-label="t.linkDialog.cancel"
              class="tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text-muted)] tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]"
              @click="closeLinkDialog"
            >
              <X :size="16" :stroke-width="2" />
            </button>
          </div>
          <div class="tpl:p-5">
            <div class="tpl:mb-4 tpl:last:mb-0">
              <label
                class="tpl:mb-1.5 tpl:block tpl:text-xs tpl:font-medium tpl:tracking-wide tpl:text-[var(--tpl-text-muted)] tpl:uppercase"
                >{{ t.linkDialog.urlLabel }}</label
              >
              <input
                v-model="linkUrl"
                type="url"
                class="tpl:w-full tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2.5 tpl:text-sm tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:outline-none tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
                :placeholder="t.linkDialog.urlPlaceholder"
                autofocus
                @keydown="handleLinkKeydown"
              />
            </div>
          </div>
          <div
            class="tpl:flex tpl:items-center tpl:justify-between tpl:border-t tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:px-5 tpl:py-4"
          >
            <button
              v-if="editor?.isActive('link')"
              type="button"
              class="tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-danger)] tpl:bg-transparent tpl:px-4 tpl:py-2 tpl:text-[13px] tpl:font-medium tpl:text-[var(--tpl-danger)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-danger-light)]"
              @click="removeLink"
            >
              {{ t.linkDialog.removeLink }}
            </button>
            <div class="tpl:ml-auto tpl:flex tpl:gap-2">
              <button
                type="button"
                class="tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-transparent tpl:px-4 tpl:py-2 tpl:text-[13px] tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]"
                @click="closeLinkDialog"
              >
                {{ t.linkDialog.cancel }}
              </button>
              <button
                type="button"
                class="tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:rounded-md tpl:border-none tpl:bg-[var(--tpl-primary)] tpl:px-4 tpl:py-2 tpl:text-[13px] tpl:font-medium tpl:text-[var(--tpl-bg)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-primary-hover)]"
                @click="insertLink"
              >
                {{
                  editor?.isActive("link")
                    ? t.linkDialog.updateLink
                    : t.linkDialog.insertLink
                }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
