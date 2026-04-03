<script setup lang="ts">
import { useFocusTrap, useI18n, useMergeTag } from "../../composables";
import type { UseEditorReturn } from "@templatical/core";
import type { TitleBlock as TitleBlockType } from "@templatical/types";
import type { Editor } from "@tiptap/core";
import type { EditorContent as EditorContentComponent } from "@tiptap/vue-3";
import { Bold, Italic, Link, LoaderCircle, ScanLine, X } from "@lucide/vue";
import { useEventListener, useTimeoutFn } from "@vueuse/core";
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
  block: TitleBlockType;
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
const { start: startFocusTimeout, stop: stopFocusTimeout } = useTimeoutFn(
  () => editor.value?.commands.focus("end"),
  0,
  { immediate: false },
);

const { t } = useI18n();

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
      { MergeTagNode, LogicMergeTagNode },
    ] = await Promise.all([
      import("@tiptap/core"),
      import("@tiptap/vue-3"),
      import("@tiptap/starter-kit"),
      import("@tiptap/extension-link"),
      import("../../extensions"),
    ]);

    EditorContent.value = EC;

    const extensions = [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      MergeTagNode.configure({
        mergeTags,
        syntax,
      }),
      LogicMergeTagNode.configure({
        syntax,
      }),
    ];

    const seen = new Map<string, number>();
    extensions.forEach((ext, i) => seen.set(ext.name, i));
    const uniqueExtensions = extensions.filter(
      (ext, i) => seen.get(ext.name) === i,
    );

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

    startFocusTimeout();
  } catch (error) {
    console.error("[TitleEditor] Failed to initialize TipTap editor:", error);
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
        editor.value.commands.setContent(newContent, { emitUpdate: false });
      }
    }
  },
);

function handleClickOutside(event: MouseEvent): void {
  if (isRequestingMergeTag.value) return;

  const target = event.target as HTMLElement;

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
</script>

<template>
  <div class="tpl-text-editor-wrapper tpl:relative">
    <Teleport to="body">
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
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('bold'),
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
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('italic'),
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
            class="tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)]"
            :class="{
              'tpl:!bg-[var(--tpl-primary)] tpl:!text-[var(--tpl-bg)]':
                editor?.isActive('link'),
            }"
            :aria-label="t.titleEditor.addLink"
            :title="t.titleEditor.addLink"
            @click="openLinkDialog"
          >
            <Link :size="16" :stroke-width="2" />
          </button>
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
            <LoaderCircle class="tpl-spinner" :size="14" :stroke-width="2" />
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
                class="tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:rounded-md tpl:border-none tpl:bg-[var(--tpl-primary)] tpl:px-4 tpl:py-2 tpl:text-[13px] tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-primary-hover)]"
                style="color: var(--tpl-bg)"
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
