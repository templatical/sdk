<script setup lang="ts">
import MediaFileIcon from "./MediaFileIcon.vue";
import { useI18n } from "../../composables/useI18n";
import { useMediaCategories } from "../../composables/useMediaCategories";
import type { MediaConversion, MediaFolder, MediaItem } from "../../types";
import { Folder } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  item: MediaItem;
  folders?: MediaFolder[];
  selectedConversion: MediaConversion;
}>();

const emit = defineEmits<{
  (e: "update:selectedConversion", value: MediaConversion): void;
}>();

const { t } = useI18n();

const { isImageMimeType } = useMediaCategories();

interface ConversionOption {
  value: MediaConversion;
  label: string;
  url: string | null;
}

const availableConversions = computed((): ConversionOption[] => {
  if (!isImage.value || !props.item.conversions_generated) {
    return [];
  }

  const options: ConversionOption[] = [];

  if (props.item.small_url) {
    options.push({
      value: "small",
      label: t.mediaLibrary.conversionSmall,
      url: props.item.small_url,
    });
  }

  if (props.item.medium_url) {
    options.push({
      value: "medium",
      label: t.mediaLibrary.conversionMedium,
      url: props.item.medium_url,
    });
  }

  if (props.item.large_url) {
    options.push({
      value: "large",
      label: t.mediaLibrary.conversionLarge,
      url: props.item.large_url,
    });
  }

  // Always add original option
  options.push({
    value: "original",
    label: t.mediaLibrary.conversionOriginal,
    url: props.item.url,
  });

  return options;
});

const hasConversions = computed(
  () => isImage.value && availableConversions.value.length > 1,
);

const previewUrl = computed(() => {
  if (!isImage.value) return null;

  switch (props.selectedConversion) {
    case "small":
      return props.item.small_url || props.item.url;
    case "medium":
      return props.item.medium_url || props.item.url;
    case "large":
      return props.item.large_url || props.item.url;
    default:
      return props.item.url;
  }
});

function handleConversionChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  emit("update:selectedConversion", target.value as MediaConversion);
}

function buildFolderPath(
  folderList: MediaFolder[],
  targetId: string,
  currentPath: string[] = [],
): string[] | null {
  for (const folder of folderList) {
    const newPath = [...currentPath, folder.name];
    if (folder.id === targetId) {
      return newPath;
    }
    if (folder.children) {
      const found = buildFolderPath(folder.children, targetId, newPath);
      if (found) return found;
    }
  }
  return null;
}

const folderPath = computed(() => {
  if (!props.item.folder_id || !props.folders) {
    return null;
  }
  const path = buildFolderPath(props.folders, props.item.folder_id);
  return path ? path.join("/") : null;
});

const isImage = computed(() => isImageMimeType(props.item.mime_type));

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
</script>

<template>
  <div class="tpl:flex tpl:items-center tpl:gap-3">
    <img
      v-if="isImage"
      :src="previewUrl ?? undefined"
      :alt="item.alt_text || item.filename"
      class="tpl:size-10 tpl:shrink-0 tpl:rounded tpl:object-cover"
      style="border: 1px solid var(--tpl-border)"
    />
    <div
      v-else
      class="tpl:flex tpl:size-10 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:overflow-hidden tpl:rounded"
      style="border: 1px solid var(--tpl-border)"
    >
      <MediaFileIcon :mime-type="item.mime_type" class="tpl-preview-icon" />
    </div>
    <div class="tpl:min-w-0 tpl:flex-1">
      <p
        class="tpl:truncate tpl:text-xs tpl:font-medium"
        style="color: var(--tpl-text)"
      >
        {{ item.filename }}
      </p>
      <p
        class="tpl:mt-0.5 tpl:text-[10px]"
        style="color: var(--tpl-text-muted)"
      >
        {{ formatSize(item.size) }}
        &middot; {{ formatDate(item.created_at) }}
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
        :class="{ 'tpl:invisible': !item.alt_text }"
        style="color: var(--tpl-text-dim)"
      >
        {{ item.alt_text || "&nbsp;" }}
      </p>
    </div>
    <!-- Conversion selector -->
    <div v-if="hasConversions" class="tpl:shrink-0">
      <label
        class="tpl:block tpl:text-[10px]"
        style="color: var(--tpl-text-muted)"
      >
        {{ t.mediaLibrary.conversionLabel }}
      </label>
      <select
        class="tpl:mt-0.5 tpl:rounded-md tpl:border tpl:py-1 tpl:pr-6 tpl:pl-2 tpl:text-xs tpl:outline-none"
        style="
          border-color: var(--tpl-border);
          background-color: var(--tpl-bg);
          color: var(--tpl-text);
        "
        :value="selectedConversion"
        @change="handleConversionChange"
      >
        <option
          v-for="option in availableConversions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.tpl-preview-icon {
  transform: scale(0.45);
  transform-origin: center;
}
</style>
