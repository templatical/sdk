<script setup lang="ts">
import MediaFileIcon from "./MediaFileIcon.vue";
import { UI_LOCALE_KEY } from "../../keys";
import { formatAbsoluteDate } from "../../utils/formatAbsoluteDate";
import { useMediaCategories } from "../../composables/useMediaCategories";
import type { MediaAsset } from "@templatical/types";
import type { MediaFolderNode } from "../../utils/treeFolders";
import { Folder } from "@lucide/vue";
import { computed, inject } from "vue";

const props = defineProps<{
  item: MediaAsset;
  folders?: MediaFolderNode[];
}>();

const uiLocale = inject(UI_LOCALE_KEY, null);

const { isImageMimeType } = useMediaCategories();

function buildFolderPath(
  folderList: MediaFolderNode[],
  targetId: string,
  currentPath: string[] = [],
): string[] | null {
  for (const folder of folderList) {
    const newPath = [...currentPath, folder.name];
    if (folder.id === targetId) {
      return newPath;
    }
    if (folder.children.length) {
      const found = buildFolderPath(folder.children, targetId, newPath);
      if (found) return found;
    }
  }
  return null;
}

const folderPath = computed(() => {
  if (!props.item.folderId || !props.folders) {
    return null;
  }
  const path = buildFolderPath(props.folders, props.item.folderId);
  return path ? path.join("/") : null;
});

const mimeType = computed(() => props.item.mimeType ?? "");
const isImage = computed(() => isImageMimeType(mimeType.value));

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return formatAbsoluteDate(dateStr, uiLocale?.value, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const filename = computed(() => props.item.filename || props.item.url);
</script>

<template>
  <div class="tpl:flex tpl:items-center tpl:gap-3">
    <img
      v-if="isImage"
      :src="item.url"
      :alt="item.alt || filename"
      class="tpl:size-10 tpl:shrink-0 tpl:rounded tpl:object-cover"
      style="border: 1px solid var(--tpl-border)"
    />
    <div
      v-else
      class="tpl:flex tpl:size-10 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:overflow-hidden tpl:rounded"
      style="border: 1px solid var(--tpl-border)"
    >
      <MediaFileIcon :mime-type="mimeType" class="tpl-preview-icon" />
    </div>
    <div class="tpl:min-w-0 tpl:flex-1">
      <p
        class="tpl:truncate tpl:text-xs tpl:font-medium"
        style="color: var(--tpl-text)"
      >
        {{ filename }}
      </p>
      <p
        class="tpl:mt-0.5 tpl:text-[10px]"
        style="color: var(--tpl-text-muted)"
      >
        <template v-if="item.size != null">{{
          formatSize(item.size)
        }}</template>
        <template v-if="item.createdAt">
          <template v-if="item.size != null"> &middot; </template>
          {{ formatDate(item.createdAt) }}
        </template>
        <template v-if="isImage && item.width && item.height">
          &middot; {{ item.width }}&times;{{ item.height }}px
        </template>
        <template v-if="folderPath">
          &middot;
          <Folder class="tpl:mb-px tpl:inline" :size="9" :stroke-width="2" />
          {{ folderPath }}
        </template>
      </p>
      <p
        v-if="isImage"
        class="tpl:mt-0.5 tpl:truncate tpl:text-[10px] tpl:italic"
        :class="{ 'tpl:invisible': !item.alt }"
        style="color: var(--tpl-text-dim)"
      >
        {{ item.alt || "&nbsp;" }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.tpl-preview-icon {
  transform: scale(0.45);
  transform-origin: center;
}
</style>
