<script setup lang="ts">
import MediaBreadcrumb from "./media/MediaBreadcrumb.vue";
import MediaFolderTree from "./media/MediaFolderTree.vue";
import MediaGrid from "./media/MediaGrid.vue";
import MediaImportUrlModal from "./media/MediaImportUrlModal.vue";
import MediaMovePicker from "./media/MediaMovePicker.vue";
import MediaPreviewPanel from "./media/MediaPreviewPanel.vue";
import MediaReplaceModal from "./media/MediaReplaceModal.vue";
import MediaUploadZone from "./media/MediaUploadZone.vue";
import StorageProgressRing from "./media/StorageProgressRing.vue";
import { useMediaCategories } from "../composables/useMediaCategories";
import { useMediaLibraryUI } from "../composables/useMediaLibraryUI";
import { useMediaLibrary } from "../composable";
import type {
  MediaAsset,
  MediaCategory,
  MediaProvider,
} from "@templatical/types";
import {
  Check,
  Copy,
  Grid2x2,
  Link,
  List,
  PanelLeft,
  Search,
  X,
} from "@lucide/vue";
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  provide,
  watch,
} from "vue";
import type { MediaTranslations } from "../i18n";
import { MEDIA_LIMITS_KEY } from "../keys";

const props = defineProps<{
  provider: MediaProvider;
  accept?: MediaCategory[];
  templateId?: string;
  onError?: (error: Error) => void;
  translations: MediaTranslations;
  showClose?: boolean;
  showConfirm?: boolean;
  confirmTestId?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm", item: MediaAsset): void;
  (e: "ready"): void;
}>();

const MediaEditModal = defineAsyncComponent(
  () => import("./media/MediaEditModal.vue"),
);

const t = computed(() => props.translations);
const resolvedConfirmTestId = computed(
  () => props.confirmTestId ?? "media-confirm",
);

const mediaLimits = {
  get maxFileSize() {
    return props.provider.maxFileSize;
  },
  get mimeTypes() {
    return props.provider.mimeTypes;
  },
  get accept() {
    return props.accept;
  },
};
provide(MEDIA_LIMITS_KEY, mediaLimits);

const { isAcceptedMimeType, availableCategories } =
  useMediaCategories(mediaLimits);

const library = useMediaLibrary({
  provider: props.provider,
  templateId: () => props.templateId,
  onError: (error) => props.onError?.(error),
});

const ui = useMediaLibraryUI({
  library,
  translations: t,
});

const canCreate = computed(() => typeof props.provider.create === "function");
const canFolders = computed(() => props.provider.folders !== false);
const canImport = computed(
  () => typeof props.provider.importFromUrl === "function",
);
const canDelete = computed(() => typeof props.provider.delete === "function");
const canUpdate = computed(() => typeof props.provider.update === "function");
const canReplace = computed(() => typeof props.provider.replace === "function");
const canFrequentlyUsed = computed(
  () => typeof props.provider.frequentlyUsed === "function",
);
const canMove = computed(() => {
  const folders = props.provider.folders;
  return folders !== false && typeof folders.move === "function";
});
const canCreateFolder = computed(() => {
  const folders = props.provider.folders;
  return folders !== false && typeof folders.create === "function";
});
const canRenameFolder = computed(() => {
  const folders = props.provider.folders;
  return folders !== false && typeof folders.update === "function";
});
const canDeleteFolder = computed(() => {
  const folders = props.provider.folders;
  return folders !== false && typeof folders.delete === "function";
});

const isInitialLoad = computed(
  () => library.isLoading.value && ui.displayItems.value.length === 0,
);

const isConfirmable = computed(() => {
  const item = library.previewItem.value;
  if (!item) {
    return false;
  }
  if (!props.accept?.length) {
    return true;
  }
  return isAcceptedMimeType(item.mimeType ?? "", props.accept);
});

const selectedDeletableCount = computed(() => {
  if (!canDelete.value) {
    return 0;
  }
  let count = 0;
  for (const id of library.selectedItems.value) {
    const item = ui.displayItems.value.find((entry) => entry.id === id);
    if (item?.canDelete !== false) {
      count += 1;
    }
  }
  return count;
});

const nestedDialogOpen = computed(
  () =>
    ui.showImportUrlModal.value ||
    ui.editingItem.value !== null ||
    library.showReplaceWarning.value,
);

function handleEscape(): boolean {
  if (nestedDialogOpen.value) {
    return true;
  }
  if (ui.showMovePicker.value) {
    ui.showMovePicker.value = false;
    return true;
  }
  if (library.showDeleteWarning.value) {
    library.cancelDelete();
    return true;
  }
  return false;
}

function confirmSelection(): void {
  if (!isConfirmable.value || !library.previewItem.value) {
    return;
  }
  emit("confirm", library.previewItem.value);
}

function handleCategoryChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  library.filterByCategory(value ? (value as MediaCategory) : null);
}

async function handleDeleteClick(): Promise<void> {
  const next = new Set<string>();
  for (const id of library.selectedItems.value) {
    const item = ui.displayItems.value.find((entry) => entry.id === id);
    if (item?.canDelete !== false) {
      next.add(id);
    }
  }
  library.selectedItems.value = next;
  await ui.handleDeleteClick();
}

watch(
  () => props.accept,
  (accept) => {
    if (accept?.length === 1) {
      library.categoryFilter.value = accept[0];
    }
  },
  { immediate: true },
);

library.loadItems();
library.loadFrequentlyUsed();
library.loadStorage();
emit("ready");

onBeforeUnmount(() => {
  ui.resetUI();
});

defineExpose({ nestedDialogOpen, handleEscape, library, ui });
</script>

<template>
  <div
    class="tpl:relative tpl:flex tpl:min-h-0 tpl:flex-1 tpl:flex-col tpl:overflow-hidden"
  >
    <!-- Header -->
    <div
      class="tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-between tpl:border-b tpl:px-5 tpl:py-3.5"
      style="border-color: var(--tpl-border)"
    >
      <h2
        id="tpl-media-library-title"
        class="tpl:text-sm tpl:font-semibold"
        style="color: var(--tpl-text)"
      >
        {{ t.mediaLibrary.title }}
      </h2>
      <div class="tpl:flex tpl:items-center tpl:gap-3">
        <StorageProgressRing
          v-if="library.storageInfo.value"
          :used-bytes="library.storageInfo.value.usedBytes"
          :limit-bytes="library.storageInfo.value.limitBytes"
          :size="22"
        />
        <div class="tpl:relative">
          <input
            :value="ui.searchInput.value"
            type="search"
            :disabled="isInitialLoad"
            :aria-label="t.mediaLibrary.searchAriaLabel"
            class="tpl:w-52 tpl:rounded-md tpl:border tpl:py-1.5 tpl:pr-3 tpl:pl-8 tpl:text-xs tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:outline-none tpl:focus:shadow-[var(--tpl-ring)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
            style="
              border-color: var(--tpl-border);
              background-color: var(--tpl-bg);
              color: var(--tpl-text);
            "
            :placeholder="t.mediaLibrary.searchPlaceholder"
            @input="
              ui.handleSearchInput(($event.target as HTMLInputElement).value)
            "
          />
          <Search
            class="tpl:absolute tpl:top-1/2 tpl:left-2.5 tpl:-translate-y-1/2"
            :size="13"
            :stroke-width="2"
            style="color: var(--tpl-text-dim)"
          />
        </div>
        <button
          v-if="showClose"
          type="button"
          :aria-label="t.mediaLibrary.close"
          class="tpl:flex tpl:size-7 tpl:items-center tpl:justify-center tpl:rounded-md tpl:transition-all tpl:duration-150"
          style="color: var(--tpl-text-muted)"
          @click="emit('close')"
        >
          <X :size="18" :stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="tpl:flex tpl:min-h-0 tpl:flex-1 tpl:overflow-hidden">
      <Transition
        enter-active-class="tpl:transition-all tpl:duration-200 tpl:ease-out"
        enter-from-class="tpl:-ml-48 tpl:opacity-0"
        enter-to-class="tpl:ml-0 tpl:opacity-100"
        leave-active-class="tpl:transition-all tpl:duration-150 tpl:ease-in"
        leave-from-class="tpl:ml-0 tpl:opacity-100"
        leave-to-class="tpl:-ml-48 tpl:opacity-0"
      >
        <div
          v-if="canFolders && ui.showSidebar.value"
          class="tpl:flex tpl:w-48 tpl:shrink-0 tpl:flex-col tpl:border-r"
          style="
            border-color: var(--tpl-border);
            background-color: var(--tpl-bg);
          "
        >
          <MediaFolderTree
            :folders="ui.folderTree.value"
            :current-folder-id="library.currentFolderId.value"
            :view-mode="library.viewMode.value"
            :has-frequently-used="
              canFrequentlyUsed && ui.hasFrequentlyUsed.value
            "
            :can-create-folder="canCreateFolder"
            :can-rename-folder="canRenameFolder"
            :can-delete-folder="canDeleteFolder"
            @navigate="library.navigateToFolder"
            @create-folder="ui.handleCreateFolder"
            @rename-folder="ui.handleRenameFolder"
            @delete-folder="ui.handleDeleteFolder"
            @show-frequently-used="library.showFrequentlyUsed"
          />
        </div>
      </Transition>

      <!-- Content area -->
      <div class="tpl:flex tpl:min-w-0 tpl:flex-1 tpl:flex-col">
        <div
          class="tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-between tpl:border-b tpl:px-4 tpl:py-2.5"
          style="border-color: var(--tpl-border)"
        >
          <div class="tpl:flex tpl:items-center tpl:gap-2">
            <button
              v-if="canFolders"
              type="button"
              data-testid="media-folder-toggle"
              class="tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:transition-all tpl:duration-150"
              :style="{
                color: ui.showSidebar.value
                  ? 'var(--tpl-primary)'
                  : 'var(--tpl-text-muted)',
                backgroundColor: ui.showSidebar.value
                  ? 'var(--tpl-bg)'
                  : 'transparent',
                border: ui.showSidebar.value
                  ? '1px solid var(--tpl-border)'
                  : '1px solid transparent',
              }"
              :title="
                ui.showSidebar.value
                  ? t.mediaLibrary.hideFolders
                  : t.mediaLibrary.showFolders
              "
              :aria-label="
                ui.showSidebar.value
                  ? t.mediaLibrary.hideFolders
                  : t.mediaLibrary.showFolders
              "
              :aria-pressed="ui.showSidebar.value"
              @click="ui.showSidebar.value = !ui.showSidebar.value"
            >
              <PanelLeft :size="16" :stroke-width="2" />
            </button>

            <template v-if="library.viewMode.value === 'frequently-used'">
              <span
                class="tpl:text-xs tpl:font-medium"
                style="color: var(--tpl-text)"
              >
                {{ t.mediaLibrary.frequentlyUsed }}
              </span>
            </template>
            <template v-else>
              <MediaBreadcrumb
                :folders="ui.folderTree.value"
                :current-folder-id="library.currentFolderId.value"
                @navigate="library.navigateToFolder"
              />
            </template>

            <div
              class="tpl:flex tpl:rounded-md tpl:p-0.5"
              style="
                border: 1px solid var(--tpl-border);
                background-color: var(--tpl-bg);
              "
            >
              <button
                type="button"
                class="tpl:flex tpl:size-6 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:transition-all tpl:duration-150"
                :style="{
                  color:
                    ui.layoutMode.value === 'grid'
                      ? 'var(--tpl-primary)'
                      : 'var(--tpl-text-muted)',
                  backgroundColor:
                    ui.layoutMode.value === 'grid'
                      ? 'var(--tpl-bg-elevated)'
                      : 'transparent',
                }"
                :title="t.mediaLibrary.viewGrid"
                :aria-label="t.mediaLibrary.viewGrid"
                :aria-pressed="ui.layoutMode.value === 'grid'"
                @click="ui.layoutMode.value = 'grid'"
              >
                <Grid2x2 :size="14" :stroke-width="2" />
              </button>
              <button
                type="button"
                class="tpl:flex tpl:size-6 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:transition-all tpl:duration-150"
                :style="{
                  color:
                    ui.layoutMode.value === 'list'
                      ? 'var(--tpl-primary)'
                      : 'var(--tpl-text-muted)',
                  backgroundColor:
                    ui.layoutMode.value === 'list'
                      ? 'var(--tpl-bg-elevated)'
                      : 'transparent',
                }"
                :title="t.mediaLibrary.viewList"
                :aria-label="t.mediaLibrary.viewList"
                :aria-pressed="ui.layoutMode.value === 'list'"
                @click="ui.layoutMode.value = 'list'"
              >
                <List :size="14" :stroke-width="2" />
              </button>
            </div>
          </div>

          <div class="tpl:flex tpl:items-center tpl:gap-2">
            <select
              v-if="availableCategories.length > 1"
              :aria-label="t.mediaLibrary.filterAriaLabel"
              class="tpl:rounded-md tpl:border tpl:py-1.5 tpl:pr-7 tpl:pl-2.5 tpl:text-xs tpl:transition-all tpl:duration-150 tpl:outline-none"
              style="
                border-color: var(--tpl-border);
                background-color: var(--tpl-bg);
                color: var(--tpl-text);
              "
              :value="library.categoryFilter.value ?? ''"
              @change="handleCategoryChange"
            >
              <option value="">
                {{ t.mediaLibrary.filterAll }}
              </option>
              <option
                v-for="category in availableCategories"
                :key="category"
                :value="category"
              >
                {{ ui.getCategoryLabel(category) }}
              </option>
            </select>
          </div>
        </div>

        <div class="tpl:min-h-0 tpl:flex-1 tpl:overflow-y-auto">
          <div
            v-if="
              library.viewMode.value === 'files' && (canCreate || canImport)
            "
            class="tpl:px-4 tpl:pt-3"
          >
            <MediaUploadZone
              v-if="canCreate"
              :is-uploading="library.isUploading.value"
              :upload-progress="library.uploadProgress.value"
              @upload="ui.handleUpload"
            />
            <button
              v-if="canImport"
              data-testid="media-import-url"
              class="tpl:mt-2 tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-dashed tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              style="
                border-color: var(--tpl-border);
                color: var(--tpl-text-muted);
                background-color: var(--tpl-bg);
              "
              @click="ui.showImportUrlModal.value = true"
            >
              <Link :size="14" :stroke-width="2" />
              {{ t.mediaLibrary.importFromUrl }}
            </button>
          </div>

          <MediaGrid
            :items="ui.displayItems.value"
            :selected-ids="library.selectedItems.value"
            :is-loading="library.isLoading.value"
            :has-more="
              library.viewMode.value === 'files' && library.hasMore.value
            "
            :accept="accept"
            :layout="ui.layoutMode.value"
            :search-query="library.searchQuery.value"
            :can-update="canUpdate"
            :can-replace="canReplace"
            @select="ui.handleSelect"
            @toggle="library.toggleSelection"
            @load-more="library.loadMore"
            @edit="ui.handleEditItem"
            @replace="ui.handleReplaceItem"
            @confirm="confirmSelection"
          />
        </div>
      </div>
    </div>

    <MediaImportUrlModal
      :visible="ui.showImportUrlModal.value"
      :is-importing="library.isImportingFromUrl.value"
      :error="library.importFromUrlError.value"
      @import="ui.handleImportFromUrl"
      @close="ui.showImportUrlModal.value = false"
    />

    <MediaEditModal
      v-if="ui.editingItem.value"
      :visible="true"
      :item="ui.editingItem.value"
      @save="ui.handleEditSave"
      @close="ui.editingItem.value = null"
    />

    <MediaReplaceModal
      :visible="library.showReplaceWarning.value"
      :item="library.pendingReplaceItem.value"
      :usage-info="library.replaceUsageInfo.value"
      :is-replacing="library.isReplacing.value"
      :error="library.replaceError.value"
      @replace="ui.handleReplaceFile"
      @close="library.cancelReplace"
    />

    <Transition
      enter-active-class="tpl:transition tpl:ease-out tpl:duration-150"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition tpl:ease-in tpl:duration-100"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <div
        v-if="library.showDeleteWarning.value"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-media-delete-title"
        class="tpl:absolute tpl:inset-0 tpl:z-10 tpl:flex tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-lg)]"
        style="
          background-color: var(--tpl-overlay);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        "
        @click.self="library.cancelDelete"
      >
        <div
          class="tpl-scale-in tpl:mx-4 tpl:w-full tpl:max-w-sm tpl:rounded-[var(--tpl-radius-lg)] tpl:p-5"
          style="
            background-color: var(--tpl-bg-elevated);
            box-shadow: var(--tpl-shadow-xl);
          "
        >
          <h3
            id="tpl-media-delete-title"
            class="tpl:mb-2 tpl:text-sm tpl:font-semibold"
            style="color: var(--tpl-text)"
          >
            {{ t.mediaLibrary.deleteWarningTitle }}
          </h3>
          <p
            class="tpl:text-xs"
            :class="ui.hasUsedFiles.value ? 'tpl:mb-2' : 'tpl:mb-4'"
            style="color: var(--tpl-text-muted)"
          >
            {{ t.mediaLibrary.deleteWarningMessage }}
          </p>
          <p
            v-if="ui.hasUsedFiles.value"
            data-testid="media-delete-usage"
            class="tpl:mb-4 tpl:text-xs"
            style="color: var(--tpl-text-muted)"
          >
            {{ t.mediaLibrary.deleteWarningUsageNote }}
          </p>

          <div
            v-if="ui.hasUsedFiles.value"
            class="tpl:mb-4 tpl:max-h-32 tpl:overflow-y-auto tpl:rounded tpl:border tpl:p-2"
            style="border-color: var(--tpl-border)"
          >
            <div
              v-for="(info, mediaId) in library.deleteUsageInfo.value"
              :key="mediaId"
              class="tpl:text-xs"
              style="color: var(--tpl-text)"
            >
              <template v-if="info.templateCount > 0">
                <span class="tpl:font-medium">
                  {{
                    ui.displayItems.value.find((i) => i.id === mediaId)
                      ?.filename || mediaId
                  }}
                </span>
                <span style="color: var(--tpl-text-muted)">
                  -
                  {{
                    t.mediaLibrary.usedInTemplates.replace(
                      "{count}",
                      info.templateCount.toString(),
                    )
                  }}
                </span>
              </template>
            </div>
          </div>

          <div class="tpl:flex tpl:justify-end tpl:gap-2">
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              style="
                border-color: var(--tpl-border);
                color: var(--tpl-text);
                background-color: var(--tpl-bg);
              "
              @click="library.cancelDelete"
            >
              {{ t.mediaLibrary.cancel }}
            </button>
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              style="
                border-color: var(--tpl-danger);
                color: var(--tpl-danger);
                background-color: var(--tpl-bg);
              "
              @click="library.confirmDelete"
            >
              {{
                ui.hasUsedFiles.value
                  ? t.mediaLibrary.deleteAnyway
                  : t.mediaLibrary.confirmDelete
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Footer -->
    <div
      class="tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-between tpl:border-t tpl:px-5 tpl:py-3"
      style="border-color: var(--tpl-border)"
    >
      <div class="tpl:flex tpl:min-w-0 tpl:flex-1 tpl:items-center tpl:gap-3">
        <MediaPreviewPanel
          v-if="library.previewItem.value"
          :item="library.previewItem.value"
          :folders="ui.folderTree.value"
        />
      </div>
      <div class="tpl:flex tpl:items-center tpl:gap-5">
        <div
          v-if="library.selectedItems.value.size > 0"
          class="tpl:flex tpl:items-center tpl:gap-2"
        >
          <button
            v-if="library.previewItem.value"
            class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
            :style="{
              borderColor: ui.copied.value
                ? 'var(--tpl-success)'
                : 'var(--tpl-border)',
              color: ui.copied.value ? 'var(--tpl-success)' : 'var(--tpl-text)',
              backgroundColor: 'var(--tpl-bg)',
            }"
            @click="ui.copy(ui.selectedUrl.value!)"
          >
            <Copy v-if="!ui.copied.value" :size="12" :stroke-width="2" />
            <Check v-else :size="12" :stroke-width="2" />
            {{
              ui.copied.value ? t.mediaLibrary.copied : t.mediaLibrary.copyUrl
            }}
          </button>
          <div v-if="canMove" class="tpl:relative">
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              style="
                border-color: var(--tpl-border);
                color: var(--tpl-text);
                background-color: var(--tpl-bg);
              "
              @click="ui.showMovePicker.value = !ui.showMovePicker.value"
            >
              {{ t.mediaLibrary.moveSelected }}
            </button>
            <MediaMovePicker
              v-if="ui.showMovePicker.value"
              :folders="ui.folderTree.value"
              :current-folder-id="library.currentFolderId.value"
              @select="ui.handleMoveToFolder"
              @close="ui.showMovePicker.value = false"
            />
          </div>
        </div>
        <div class="tpl:flex tpl:items-center tpl:gap-2">
          <button
            v-if="selectedDeletableCount > 0"
            data-testid="media-delete"
            class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
            style="
              border-color: var(--tpl-danger);
              color: var(--tpl-danger);
              background-color: var(--tpl-bg);
            "
            @click="handleDeleteClick"
          >
            {{ t.mediaLibrary.deleteSelected }}
          </button>
          <button
            v-if="showConfirm"
            :data-testid="resolvedConfirmTestId"
            class="tpl:cursor-pointer tpl:rounded-md tpl:px-4 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-primary-hover)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
            style="
              background-color: var(--tpl-primary);
              color: var(--tpl-on-primary);
            "
            :disabled="!isConfirmable"
            @click="confirmSelection"
          >
            {{
              accept?.length
                ? t.mediaLibrary.selectImage
                : t.mediaLibrary.selectFile
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
