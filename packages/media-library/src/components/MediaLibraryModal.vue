<script setup lang="ts">
import MediaBreadcrumb from "./media/MediaBreadcrumb.vue";
import MediaEditModal from "./media/MediaEditModal.vue";
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
import { useEventListener } from "@vueuse/core";
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
import { computed, provide, ref, toRef, watch } from "vue";
import {
  MEDIA_LIMITS_KEY,
  POPOVER_TARGET_KEY,
  TRANSLATIONS_KEY,
  UI_LOCALE_KEY,
  UI_THEME_KEY,
} from "../keys";
import { loadMediaTranslations, type MediaTranslations } from "../i18n";

const props = defineProps<{
  visible: boolean;
  /**
   * Storage backend. **A prop, not an injection.** An injection would have
   * to agree with the host on key identity: a bare string never resolves
   * the `Symbol` a host provides, and the miss is silent. A prop is checked
   * at compile time.
   */
  provider: MediaProvider;
  accept?: MediaCategory[];
  popoverTarget?: HTMLElement | null;
  /**
   * BCP-47 locale for this package's own strings, defaulting to English.
   *
   * A locale rather than the strings themselves: media-library owns its
   * translations and loads them here, so a host passes a value it already has
   * and never handles media copy. That also keeps the load lazy — the host
   * imports nothing from this package's i18n, so nothing is fetched until this
   * modal mounts.
   */
  locale?: string;
  /**
   * Resolved UI theme (`"light"` / `"dark"`) for the overlay chrome.
   *
   * A plain string rather than the host's ref: props are reactive, so the
   * computed below tracks a host theme toggle without this package depending on
   * how the host stores it.
   */
  uiTheme?: string;
  /** Forwarded on list / create / importFromUrl when a template is loaded. */
  templateId?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select", item: MediaAsset): void;
}>();

const translations = ref<MediaTranslations | null>(null);
watch(
  () => props.locale,
  async (locale) => {
    translations.value = await loadMediaTranslations(locale ?? "en");
  },
  { immediate: true },
);

provide(TRANSLATIONS_KEY, translations);

const t = computed(() => translations.value as MediaTranslations);
const tplUiTheme = computed(() => props.uiTheme);
provide(UI_THEME_KEY, tplUiTheme);

const popoverTargetRef = toRef(() => props.popoverTarget ?? null);
provide(POPOVER_TARGET_KEY, popoverTargetRef);

provide(
  UI_LOCALE_KEY,
  toRef(() => props.locale),
);

// Getters, not a snapshot: Cloud implements maxFileSize / mimeTypes as
// getters over plan config that arrives after this component's setup.
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

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      if (props.accept?.length === 1) {
        library.categoryFilter.value = props.accept[0];
      }
      library.loadItems();
      library.loadFrequentlyUsed();
      library.loadStorage();
    } else {
      ui.resetUI();
    }
  },
  { immediate: true },
);

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
}
useEventListener(document, "keydown", handleKeydown);

function confirmSelection(): void {
  if (!isConfirmable.value || !library.previewItem.value) {
    return;
  }
  emit("select", library.previewItem.value);
  emit("close");
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
</script>

<template>
  <Teleport :to="popoverTarget || 'body'">
    <Transition
      enter-active-class="tpl:transition tpl:duration-200"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition tpl:duration-150"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <!-- `translations` gates the subtree, not just this element's own labels:
           every descendant unwraps `TRANSLATIONS_KEY` at its own setup, so none
           may mount before the locale's strings have landed. -->
      <div
        v-if="visible && translations"
        :data-tpl-theme="tplUiTheme"
        class="tpl tpl-media-overlay tpl:fixed tpl:inset-0 tpl:z-10 tpl:flex tpl:items-center tpl:justify-center tpl:p-4"
        @click.self="emit('close')"
      >
        <!-- Caps are percentages of the overlay, never viewport units. This
             overlay is `fixed; inset: 0`, which covers the viewport only while
             nothing traps it — an ancestor with `transform`, `filter`,
             `backdrop-filter`, `will-change: transform`, `contain: paint` or
             `container-type` becomes the containing block for fixed
             descendants, and this modal teleports into the editor's popover
             root, i.e. inside a consumer's markup. `inset: 0` then resolves to
             that ancestor's box while a viewport cap does not, and the panel
             overflows a container that usually also has `overflow: hidden`.
             Percentages resolve against whatever the overlay turned out to be.
             Locked by `tests/overlay-height-scope-audit.test.ts`.

             `tpl:z-10` beats auto siblings inside the popover root's stacking
             context. A large number is not needed and would fight the
             suggestion popup that also lives there.

             `p-4` is the gutter, and it belongs on this element rather than on
             the panel: insets size the overlay's border box, so padding here
             shrinks the content box the panel measures against. `height` stays
             a fixed preference — `max-height` is what reins it in. -->
        <div
          class="tpl-media-modal tpl-scale-in tpl:flex tpl:flex-col tpl:overflow-hidden tpl:rounded-[var(--tpl-radius-lg)]"
          style="
            width: 900px;
            height: 650px;
            max-width: 100%;
            max-height: 90%;
            background-color: var(--tpl-bg-elevated);
            border: 1px solid var(--tpl-border);
            box-shadow: var(--tpl-shadow-xl);
          "
        >
          <!-- Header -->
          <div
            class="tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-between tpl:border-b tpl:px-5 tpl:py-3.5"
            style="border-color: var(--tpl-border)"
          >
            <h2
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
                  type="text"
                  :disabled="isInitialLoad"
                  class="tpl:w-52 tpl:rounded-md tpl:border tpl:py-1.5 tpl:pr-3 tpl:pl-8 tpl:text-xs tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:outline-none tpl:focus:shadow-[var(--tpl-ring)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
                  style="
                    border-color: var(--tpl-border);
                    background-color: var(--tpl-bg);
                    color: var(--tpl-text);
                  "
                  :placeholder="t.mediaLibrary.searchPlaceholder"
                  @input="
                    ui.handleSearchInput(
                      ($event.target as HTMLInputElement).value,
                    )
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
                      @click="ui.layoutMode.value = 'grid'"
                    >
                      <Grid2x2 :size="14" :stroke-width="2" />
                    </button>
                    <button
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
                      @click="ui.layoutMode.value = 'list'"
                    >
                      <List :size="14" :stroke-width="2" />
                    </button>
                  </div>
                </div>

                <div class="tpl:flex tpl:items-center tpl:gap-2">
                  <select
                    v-if="availableCategories.length > 1"
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
                    library.viewMode.value === 'files' &&
                    (canCreate || canImport)
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
            :visible="!!ui.editingItem.value"
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
                      background-color: var(--tpl-danger-light);
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
            <div
              class="tpl:flex tpl:min-w-0 tpl:flex-1 tpl:items-center tpl:gap-3"
            >
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
                    color: ui.copied.value
                      ? 'var(--tpl-success)'
                      : 'var(--tpl-text)',
                    backgroundColor: 'var(--tpl-bg)',
                  }"
                  @click="ui.copy(ui.selectedUrl.value!)"
                >
                  <Copy v-if="!ui.copied.value" :size="12" :stroke-width="2" />
                  <Check v-else :size="12" :stroke-width="2" />
                  {{
                    ui.copied.value
                      ? t.mediaLibrary.copied
                      : t.mediaLibrary.copyUrl
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
                  class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
                  style="
                    border-color: var(--tpl-danger);
                    color: var(--tpl-danger);
                    background-color: var(--tpl-danger-light);
                  "
                  @click="handleDeleteClick"
                >
                  {{ t.mediaLibrary.deleteSelected }}
                </button>
                <button
                  data-testid="media-confirm"
                  class="tpl:cursor-pointer tpl:rounded-md tpl:px-4 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
                  style="
                    background-color: var(--tpl-primary);
                    color: var(--tpl-bg);
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
      </div>
    </Transition>
  </Teleport>
</template>
