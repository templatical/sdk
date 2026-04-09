<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type { Editor } from "@tiptap/vue-3";
import type { Component } from "vue";

defineProps<{
  editor: Editor | null;
  editorContent: Component | null;
  isLoading: boolean;
  initError: string | null;
}>();

const emit = defineEmits<{
  (e: "retry"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="isLoading"
    class="tpl-text-editable tpl:min-h-[1.5em] tpl:rounded tpl:border tpl:border-dashed tpl:border-[var(--tpl-primary)] tpl:p-2"
  >
    <div class="tpl:animate-pulse tpl:text-[var(--tpl-text-dim)]">
      {{ t.errors.editorLoading }}
    </div>
  </div>
  <div
    v-else-if="initError"
    class="tpl-text-editable tpl:min-h-[1.5em] tpl:rounded tpl:border tpl:border-dashed tpl:p-2 tpl:text-center tpl:text-xs"
    style="border-color: var(--tpl-danger); color: var(--tpl-text-muted)"
  >
    {{ t.errors.editorLoadFailed }}
    <button
      class="tpl:ml-1 tpl:cursor-pointer tpl:border-none tpl:bg-transparent tpl:p-0 tpl:underline"
      style="color: var(--tpl-primary)"
      @click="emit('retry')"
    >
      {{ t.errors.retry }}
    </button>
  </div>
  <component
    :is="editorContent"
    v-else-if="editorContent && editor"
    :editor="editor as Editor"
    class="tpl-text-editable tpl:min-h-[1.5em] tpl:rounded tpl:border tpl:border-dashed tpl:border-[var(--tpl-primary)] tpl:p-2"
  />
</template>
