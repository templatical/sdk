<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type { MediaFolder } from "../../types";
import { ChevronRight } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  folders: MediaFolder[];
  currentFolderId: string | null;
}>();

const emit = defineEmits<{
  (e: "navigate", folderId: string | null): void;
}>();

const { t } = useI18n();

const breadcrumbPath = computed(() => {
  if (!props.currentFolderId) return [];
  const path: MediaFolder[] = [];
  buildPath(props.folders, props.currentFolderId, path);
  return path;
});

function buildPath(
  folderList: MediaFolder[],
  targetId: string,
  path: MediaFolder[],
): boolean {
  for (const folder of folderList) {
    if (folder.id === targetId) {
      path.push(folder);
      return true;
    }
    if (folder.children && buildPath(folder.children, targetId, path)) {
      path.unshift(folder);
      return true;
    }
  }
  return false;
}
</script>

<template>
  <div
    v-if="breadcrumbPath.length > 0"
    class="tpl:flex tpl:items-center tpl:gap-1 tpl:text-xs"
    style="color: var(--tpl-text-muted)"
  >
    <button
      class="tpl:transition-colors tpl:duration-150 tpl:hover:underline"
      style="color: var(--tpl-primary)"
      @click="emit('navigate', null)"
    >
      {{ t.mediaLibrary.allFiles }}
    </button>
    <template v-for="(folder, index) in breadcrumbPath" :key="folder.id">
      <ChevronRight :size="12" :stroke-width="2" />
      <button
        v-if="index < breadcrumbPath.length - 1"
        class="tpl:transition-colors tpl:duration-150 tpl:hover:underline"
        style="color: var(--tpl-primary)"
        @click="emit('navigate', folder.id)"
      >
        {{ folder.name }}
      </button>
      <span v-else style="color: var(--tpl-text)">{{ folder.name }}</span>
    </template>
  </div>
</template>
