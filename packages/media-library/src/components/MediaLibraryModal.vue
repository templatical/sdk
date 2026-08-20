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
import type { UsePlanConfigReturn } from "@templatical/core/cloud";
import { useMediaLibrary } from "../composable";
import type { MediaCategory, MediaItem } from "../types";
import type { AuthManager } from "@templatical/core/cloud";
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
  PLAN_CONFIG_KEY,
  POPOVER_TARGET_KEY,
  TRANSLATIONS_KEY,
  UI_THEME_KEY,
} from "../keys";
import { loadMediaTranslations, type MediaTranslations } from "../i18n";

const props = defineProps<{
  visible: boolean;
  accept?: MediaCategory[];
  /**
   * Authenticated Cloud session. **A prop, not an injection.** An injection would
   * have to agree with the host on key *identity*: a bare string never resolves
   * the `Symbol` `@templatical/editor` provides, and the miss is silent —
   * `undefined` here means the library opens and does nothing. A prop is checked
   * at compile time, which makes that class of miss impossible rather than merely
   * fixed.
   */
  authManager: AuthManager;
  /** Scopes every request. Same story as {@link authManager}. */
  projectId: string;
  /**
   * The active plan's config — media limits and the storage gauge. Re-provided
   * under `PLAN_CONFIG_KEY` for the five descendants that call
   * `useMediaCategories`, which is why this one is a prop *and* a provide.
   */
  planConfig: UsePlanConfigReturn;
  /**
   * Mount target for the modal's teleport. When provided, the modal and
   * its sub-modals render inside this element instead of `document.body`
   * — used by editors that wrap the media library inside a shadow root
   * (or any other DOM boundary) and want the modal to stay inside.
   * Defaults to `null` → teleport to body, preserving the original
   * standalone-SDK behavior.
   */
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
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select", item: MediaItem): void;
}>();

// Loaded here rather than injected from the host: a bare-string key never
// resolves the `Symbol` `@templatical/editor` provides under the same name, so
// a host-mounted modal used to get `undefined` and throw on its first label.
const translations = ref<MediaTranslations | null>(null);
watch(
  () => props.locale,
  async (locale) => {
    translations.value = await loadMediaTranslations(locale ?? "en");
  },
  { immediate: true },
);

// Descendants unwrap this at *their* setup, so the `v-if` below is what
// guarantees they never read a null. See `useI18n`.
provide(TRANSLATIONS_KEY, translations);

// Not `useI18n()` — a component never sees its own `provide`. The template's
// 28 reads auto-unwrap this, and `useMediaLibraryUI` accepts a ref.
// The `v-if` on the root guarantees non-null wherever the template reads it.
const t = computed(() => translations.value as MediaTranslations);
// Provided, not injected: the three sub-modals teleport out of this component's
// DOM, so a prop cannot reach them. Never a bare-string key — that is what left
// the library light inside a dark editor.
const tplUiTheme = computed(() => props.uiTheme);
provide(UI_THEME_KEY, tplUiTheme);

// Sub-modals (MediaReplaceModal, MediaEditModal, MediaImportUrlModal) inject
// the same target so every nested teleport lands in the same place as this
// one. Wrap the prop in a reactive ref so the provide updates if the host
// remounts the modal with a different target.
const popoverTargetRef = toRef(() => props.popoverTarget ?? null);
provide(POPOVER_TARGET_KEY, popoverTargetRef);

// Deep descendants (MediaGrid, MediaUploadZone, MediaPreviewPanel,
// MediaEditModal) read the media limits through `useMediaCategories`, so the
// prop is re-provided rather than drilled through four component layers. The
// value still arrives as a prop, which is what keeps the package boundary typed.
//
// The object itself is stable (a host builds it once) and its reactivity lives in
// the refs inside it, so providing it at setup is enough — no `toRef` dance.
provide(PLAN_CONFIG_KEY, props.planConfig);

// Folders and URL import render on every plan: gating Cloud's media *UI* meters
// no resource Cloud buys, so the media tier is limits-only and every plan gets
// the same library. (URL import's real cost — bandwidth and SSRF exposure — is a
// backend rate-limit and allow-list concern, not a client-side plan flag.)

// Storage info
const storageUsedBytes = computed(
  () => props.planConfig.config.value?.storage.used_bytes ?? 0,
);
const storageLimitBytes = computed(
  () => props.planConfig.config.value?.storage.limit_bytes ?? 0,
);

// `props.planConfig`, not the provide above: a component never sees its own
// `provide` (Vue resolves `inject` against the parent chain), so injecting
// here would throw in every host.
const { isAcceptedMimeType, availableCategories } = useMediaCategories(
  props.planConfig,
);

const library = useMediaLibrary({
  projectId: props.projectId,
  authManager: props.authManager,
});

const ui = useMediaLibraryUI({
  library,
  translations: t,
});

// Modal-specific: load on open, reset on close
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      library.loadItems();
      library.loadFrequentlyUsed();
    } else {
      ui.resetUI();
    }
  },
);

// Modal-specific: escape key
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
}
useEventListener(document, "keydown", handleKeydown);

// Modal-specific: accept filter + selection
function isConfirmable(): boolean {
  if (!library.previewItem.value) {
    return false;
  }

  if (!props.accept?.length) {
    return true;
  }

  return isAcceptedMimeType(library.previewItem.value.mime_type, props.accept);
}

function confirmSelection(): void {
  if (isConfirmable()) {
    const item = library.previewItem.value!;
    const itemWithSelectedUrl: MediaItem = {
      ...item,
      url: ui.selectedUrl.value || item.url,
    };
    emit("select", itemWithSelectedUrl);
    emit("close");
  }
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
        class="tpl tpl-media-overlay tpl:fixed tpl:inset-0 tpl:z-[9999]"
        @click.self="emit('close')"
      >
        <div
          class="tpl-media-modal tpl-scale-in tpl:flex tpl:flex-col tpl:overflow-hidden tpl:rounded-[var(--tpl-radius-lg)]"
          style="
            width: 900px;
            height: 650px;
            max-width: 95vw;
            max-height: 90vh;
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
                :used-bytes="storageUsedBytes"
                :limit-bytes="storageLimitBytes"
                :size="22"
              />
              <div class="tpl:relative">
                <input
                  :value="ui.searchInput.value"
                  type="text"
                  class="tpl:w-52 tpl:rounded-md tpl:border tpl:py-1.5 tpl:pr-3 tpl:pl-8 tpl:text-xs tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:outline-none tpl:focus:shadow-[var(--tpl-ring)]"
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
            <!-- Sidebar (only when media folders feature is enabled and toggled on) -->
            <Transition
              enter-active-class="tpl:transition-all tpl:duration-200 tpl:ease-out"
              enter-from-class="tpl:-ml-48 tpl:opacity-0"
              enter-to-class="tpl:ml-0 tpl:opacity-100"
              leave-active-class="tpl:transition-all tpl:duration-150 tpl:ease-in"
              leave-from-class="tpl:ml-0 tpl:opacity-100"
              leave-to-class="tpl:-ml-48 tpl:opacity-0"
            >
              <div
                v-if="ui.showSidebar.value"
                class="tpl:flex tpl:w-48 tpl:shrink-0 tpl:flex-col tpl:border-r"
                style="
                  border-color: var(--tpl-border);
                  background-color: var(--tpl-bg);
                "
              >
                <MediaFolderTree
                  :folders="library.folders.value"
                  :current-folder-id="library.currentFolderId.value"
                  :view-mode="library.viewMode.value"
                  :has-frequently-used="ui.hasFrequentlyUsed.value"
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
              <!-- Breadcrumb + Upload -->
              <div
                class="tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-between tpl:border-b tpl:px-4 tpl:py-2.5"
                style="border-color: var(--tpl-border)"
              >
                <div class="tpl:flex tpl:items-center tpl:gap-2">
                  <!-- Sidebar toggle (only when media folders feature is enabled) -->
                  <button
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
                      :folders="library.folders.value"
                      :current-folder-id="library.currentFolderId.value"
                      @navigate="library.navigateToFolder"
                    />
                  </template>

                  <!-- Layout toggle -->
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
                    @change="
                      library.filterByCategory(
                        ($event.target as HTMLSelectElement).value || null,
                      )
                    "
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
                  <select
                    class="tpl:rounded-md tpl:border tpl:py-1.5 tpl:pr-7 tpl:pl-2.5 tpl:text-xs tpl:transition-all tpl:duration-150 tpl:outline-none"
                    style="
                      border-color: var(--tpl-border);
                      background-color: var(--tpl-bg);
                      color: var(--tpl-text);
                    "
                    :value="library.sortOption.value"
                    @change="
                      library.sortBy(($event.target as HTMLSelectElement).value)
                    "
                  >
                    <option value="newest">
                      {{ t.mediaLibrary.sortNewest }}
                    </option>
                    <option value="oldest">
                      {{ t.mediaLibrary.sortOldest }}
                    </option>
                    <option value="name_asc">
                      {{ t.mediaLibrary.sortNameAsc }}
                    </option>
                    <option value="name_desc">
                      {{ t.mediaLibrary.sortNameDesc }}
                    </option>
                    <option value="size_asc">
                      {{ t.mediaLibrary.sortSizeAsc }}
                    </option>
                    <option value="size_desc">
                      {{ t.mediaLibrary.sortSizeDesc }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Scrollable content area -->
              <div class="tpl:min-h-0 tpl:flex-1 tpl:overflow-y-auto">
                <!-- Upload zone (only in files mode) -->
                <div
                  v-if="library.viewMode.value === 'files'"
                  class="tpl:px-4 tpl:pt-3"
                >
                  <MediaUploadZone
                    :is-uploading="library.isUploading.value"
                    :upload-progress="library.uploadProgress.value"
                    @upload="ui.handleUpload"
                  />
                  <button
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

                <!-- Image grid -->
                <MediaGrid
                  :items="ui.displayItems.value"
                  :selected-ids="library.selectedItems.value"
                  :is-loading="library.isLoading.value"
                  :has-more="
                    library.viewMode.value === 'files' && library.hasMore.value
                  "
                  :accept="accept"
                  :layout="ui.layoutMode.value"
                  @select="ui.handleSelect"
                  @toggle="library.toggleSelection"
                  @load-more="library.loadMore"
                  @edit="ui.handleEditItem"
                  @replace="ui.handleReplaceItem"
                />
              </div>
            </div>
          </div>

          <!-- Import from URL Modal -->
          <MediaImportUrlModal
            :visible="ui.showImportUrlModal.value"
            :is-importing="library.isImportingFromUrl.value"
            :error="library.importFromUrlError.value"
            @import="ui.handleImportFromUrl"
            @close="ui.showImportUrlModal.value = false"
          />

          <!-- Edit Modal -->
          <MediaEditModal
            :visible="!!ui.editingItem.value"
            :item="ui.editingItem.value"
            @save="ui.handleEditSave"
            @close="ui.editingItem.value = null"
          />

          <!-- Replace Modal -->
          <MediaReplaceModal
            :visible="library.showReplaceWarning.value"
            :item="library.pendingReplaceItem.value"
            :usage-info="library.replaceUsageInfo.value"
            :is-replacing="library.isReplacing.value"
            :error="library.replaceError.value"
            @replace="ui.handleReplaceFile"
            @close="library.cancelReplace"
          />

          <!-- Delete Warning Dialog -->
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
                    <template v-if="info.template_count > 0">
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
                            info.template_count.toString(),
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
                v-model:selected-conversion="ui.selectedConversion.value"
                :item="library.previewItem.value"
                :folders="library.folders.value"
              />
            </div>
            <div class="tpl:flex tpl:items-center tpl:gap-5">
              <!-- Copy URL + Move group -->
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
                <div class="tpl:relative">
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
                    :folders="library.folders.value"
                    :current-folder-id="library.currentFolderId.value"
                    @select="ui.handleMoveToFolder"
                    @close="ui.showMovePicker.value = false"
                  />
                </div>
              </div>
              <!-- Delete + Select group -->
              <div class="tpl:flex tpl:items-center tpl:gap-2">
                <button
                  v-if="library.selectedItems.value.size > 0"
                  class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
                  style="
                    border-color: var(--tpl-danger);
                    color: var(--tpl-danger);
                    background-color: var(--tpl-danger-light);
                  "
                  @click="ui.handleDeleteClick"
                >
                  {{ t.mediaLibrary.deleteSelected }}
                </button>
                <button
                  class="tpl:cursor-pointer tpl:rounded-md tpl:px-4 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
                  style="
                    background-color: var(--tpl-primary);
                    color: var(--tpl-bg);
                  "
                  :disabled="!isConfirmable()"
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
