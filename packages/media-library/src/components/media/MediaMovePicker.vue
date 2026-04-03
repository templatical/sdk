<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type { MediaFolder } from "../../types";
import { onClickOutside } from "@vueuse/core";
import { File, Folder } from "@lucide/vue";
import { ref } from "vue";

defineProps<{
  folders: MediaFolder[];
  currentFolderId: string | null;
}>();

const emit = defineEmits<{
  (e: "select", folderId: string | null): void;
  (e: "close"): void;
}>();

const { t } = useI18n();
const pickerRef = ref<HTMLDivElement | null>(null);

interface FlatFolder {
  id: string;
  name: string;
  depth: number;
}

function flattenFolders(
  folders: MediaFolder[],
  depth: number = 0,
): FlatFolder[] {
  const result: FlatFolder[] = [];
  for (const folder of folders) {
    result.push({ id: folder.id, name: folder.name, depth });
    if (folder.children?.length) {
      result.push(...flattenFolders(folder.children, depth + 1));
    }
  }
  return result;
}

onClickOutside(pickerRef, () => {
  emit("close");
});
</script>

<template>
  <div
    ref="pickerRef"
    class="tpl:absolute tpl:bottom-full tpl:left-0 tpl:z-10 tpl:mb-2 tpl:w-56 tpl:overflow-hidden tpl:rounded-lg tpl:border tpl:shadow-lg"
    style="
      border-color: var(--tpl-border);
      background-color: var(--tpl-bg-elevated);
    "
  >
    <div class="tpl:max-h-56 tpl:overflow-y-auto tpl:py-1">
      <button
        v-if="currentFolderId !== null"
        class="tpl:flex tpl:w-full tpl:items-center tpl:gap-1.5 tpl:px-3 tpl:py-1.5 tpl:text-left tpl:text-xs tpl:transition-colors tpl:duration-100"
        style="color: var(--tpl-text)"
        @click="emit('select', null)"
      >
        <File class="tpl:shrink-0" :size="14" :stroke-width="1.5" />
        {{ t.mediaLibrary.moveToRoot }}
      </button>
      <button
        v-for="folder in flattenFolders(folders)"
        :key="folder.id"
        class="tpl:flex tpl:w-full tpl:items-center tpl:gap-1.5 tpl:py-1.5 tpl:pr-3 tpl:text-left tpl:text-xs tpl:transition-colors tpl:duration-100"
        :style="{
          paddingLeft: `${folder.depth * 16 + 12}px`,
          color:
            folder.id === currentFolderId
              ? 'var(--tpl-text-dim)'
              : 'var(--tpl-text)',
          opacity: folder.id === currentFolderId ? 0.5 : 1,
        }"
        :disabled="folder.id === currentFolderId"
        @click="emit('select', folder.id)"
      >
        <Folder class="tpl:shrink-0" :size="14" :stroke-width="1.5" />
        <span class="tpl:truncate">{{ folder.name }}</span>
        <span
          v-if="folder.id === currentFolderId"
          class="tpl:shrink-0"
          style="color: var(--tpl-text-dim)"
        >
          {{ t.mediaLibrary.currentFolder }}
        </span>
      </button>
    </div>
  </div>
</template>
