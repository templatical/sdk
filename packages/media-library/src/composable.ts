import type {
  MediaAsset,
  MediaAssetPatch,
  MediaCategory,
  MediaCreateInput,
  MediaFolder,
  MediaFoldersProvider,
  MediaFolderInput,
  MediaListParams,
  MediaProvider,
  MediaStorageInfo,
  MediaUsageInfo,
} from "@templatical/types";
import { ref, toValue, type MaybeRefOrGetter, type Ref } from "vue";

export type MediaViewMode = "files" | "frequently-used";

export interface UseMediaLibraryOptions {
  /**
   * Storage backend. The composable is transport-agnostic and never talks
   * to a network itself.
   */
  provider: MediaProvider;
  onError?: (error: Error) => void;
  /**
   * Forwarded on `list` / `create` / `importFromUrl` when a template is
   * loaded. Read at call time — a ref that fills after setup must still
   * reach the store.
   */
  templateId?: MaybeRefOrGetter<string | undefined>;
}

/**
 * Reactive state over a {@link MediaProvider}.
 *
 * Owns the listing, selection, preview, sequential upload loop and the
 * delete-usage flow. Chrome that should hide for a `false` method is the
 * modal's job; this composable simply does not call a disabled method.
 */
export function useMediaLibrary(options: UseMediaLibraryOptions) {
  const { provider } = options;

  const items: Ref<MediaAsset[]> = ref([]);
  const folders: Ref<MediaFolder[]> = ref([]);
  const currentFolderId: Ref<string | null> = ref(null);
  const viewMode: Ref<MediaViewMode> = ref("files");
  const searchQuery: Ref<string> = ref("");
  const categoryFilter: Ref<MediaCategory | null> = ref(null);
  const sortOption: Ref<string> = ref("newest");
  const isLoading = ref(false);
  const isUploading = ref(false);
  const hasMore = ref(false);
  const nextCursor: Ref<string | null> = ref(null);
  const uploadProgress: Ref<{ current: number; total: number } | null> =
    ref(null);
  const selectedItems: Ref<Set<string>> = ref(new Set());
  const previewItem: Ref<MediaAsset | null> = ref(null);
  const frequentlyUsedItems: Ref<MediaAsset[]> = ref([]);
  const deleteUsageInfo: Ref<Record<string, MediaUsageInfo>> = ref({});
  const showDeleteWarning = ref(false);
  const pendingDeleteIds: Ref<string[]> = ref([]);
  const isImportingFromUrl = ref(false);
  const importFromUrlError: Ref<string | null> = ref(null);
  const isReplacing = ref(false);
  const replaceError: Ref<string | null> = ref(null);
  const showReplaceWarning = ref(false);
  const pendingReplaceItem: Ref<MediaAsset | null> = ref(null);
  const replaceUsageInfo: Ref<MediaUsageInfo | null> = ref(null);
  const storageInfo: Ref<MediaStorageInfo | null> = ref(null);

  // Monotonic token so an out-of-order list/loadMore response (folder
  // switch / search change before the previous request settled) cannot
  // overwrite the current view with stale data.
  let browseRequestId = 0;

  /**
   * A handler that throws must not turn a completed write into a rejected
   * one — the UI would report a failure for an asset that was stored.
   */
  function notify(run: () => void): void {
    try {
      run();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  function foldersProvider(): MediaFoldersProvider | null {
    return provider.folders === false ? null : provider.folders;
  }

  /**
   * `sort` is absent: {@link MediaListParams} has no sort field.
   * `sortOption` stays as local UI state; changing it reloads the current
   * filters without inventing an order the store did not advertise.
   */
  function resolvedTemplateId(): string | undefined {
    return toValue(options.templateId);
  }

  function currentListParams(cursor?: string): MediaListParams {
    const params: MediaListParams = {};
    if (searchQuery.value) {
      params.search = searchQuery.value;
    } else if (currentFolderId.value != null) {
      params.folderId = currentFolderId.value;
    }
    if (categoryFilter.value) {
      params.category = categoryFilter.value;
    }
    if (cursor) {
      params.cursor = cursor;
    }
    const templateId = resolvedTemplateId();
    if (templateId) {
      params.templateId = templateId;
    }
    return params;
  }

  async function loadItems(): Promise<void> {
    const requestId = ++browseRequestId;
    isLoading.value = true;
    const params = currentListParams();
    try {
      const page = await provider.list(params);
      if (requestId !== browseRequestId) return;
      items.value = page.items;
      nextCursor.value = page.nextCursor ?? null;
      hasMore.value = !!page.nextCursor;
    } catch (error) {
      if (requestId !== browseRequestId) return;
      options.onError?.(error as Error);
    } finally {
      if (requestId === browseRequestId) {
        isLoading.value = false;
      }
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || !nextCursor.value || isLoading.value) return;

    const requestId = ++browseRequestId;
    isLoading.value = true;
    const params = currentListParams(nextCursor.value);
    try {
      const page = await provider.list(params);
      if (requestId !== browseRequestId) return;
      items.value = [...items.value, ...page.items];
      nextCursor.value = page.nextCursor ?? null;
      hasMore.value = !!page.nextCursor;
    } catch (error) {
      if (requestId !== browseRequestId) return;
      options.onError?.(error as Error);
    } finally {
      if (requestId === browseRequestId) {
        isLoading.value = false;
      }
    }
  }

  async function search(query: string): Promise<void> {
    searchQuery.value = query;
    await loadItems();
  }

  async function filterByCategory(
    category: MediaCategory | null,
  ): Promise<void> {
    categoryFilter.value = category;
    await loadItems();
  }

  async function sortBy(option: string): Promise<void> {
    sortOption.value = option;
    await loadItems();
  }

  async function navigateToFolder(folderId: string | null): Promise<void> {
    viewMode.value = "files";
    currentFolderId.value = folderId;
    searchQuery.value = "";
    selectedItems.value = new Set();
    previewItem.value = null;
    await loadItems();
  }

  async function showFrequentlyUsed(): Promise<void> {
    viewMode.value = "frequently-used";
    currentFolderId.value = null;
    searchQuery.value = "";
    selectedItems.value = new Set();
    previewItem.value = null;
    await loadFrequentlyUsed();
  }

  async function uploadFile(file: File): Promise<MediaAsset | null> {
    const { create } = provider;
    if (typeof create !== "function") {
      return null;
    }

    isUploading.value = true;
    try {
      const input: MediaCreateInput = { file };
      if (currentFolderId.value != null) {
        input.folderId = currentFolderId.value;
      }
      const templateId = resolvedTemplateId();
      if (templateId) {
        input.templateId = templateId;
      }
      const media = await create(input);
      items.value = [media, ...items.value];
      notify(() => provider.onCreated?.(media));
      return media;
    } catch (error) {
      options.onError?.(error as Error);
      return null;
    } finally {
      isUploading.value = false;
    }
  }

  async function uploadFiles(files: File[]): Promise<void> {
    const { create } = provider;
    if (typeof create !== "function") {
      return;
    }

    isUploading.value = true;
    uploadProgress.value = { current: 0, total: files.length };
    try {
      for (let i = 0; i < files.length; i++) {
        uploadProgress.value = { current: i + 1, total: files.length };
        try {
          const input: MediaCreateInput = { file: files[i] };
          if (currentFolderId.value != null) {
            input.folderId = currentFolderId.value;
          }
          const templateId = resolvedTemplateId();
          if (templateId) {
            input.templateId = templateId;
          }
          const media = await create(input);
          items.value = [media, ...items.value];
          notify(() => provider.onCreated?.(media));
        } catch (error) {
          options.onError?.(error as Error);
        }
      }
    } finally {
      isUploading.value = false;
      uploadProgress.value = null;
    }
  }

  async function moveSelected(targetFolderId: string | null): Promise<void> {
    if (selectedItems.value.size === 0) {
      return;
    }

    const foldersApi = foldersProvider();
    const { move } = foldersApi ?? { move: false };
    if (typeof move !== "function") {
      return;
    }

    try {
      const movedItems = await move([...selectedItems.value], targetFolderId);
      if (currentFolderId.value === null) {
        const movedMap = new Map(movedItems.map((item) => [item.id, item]));
        items.value = items.value.map((item) => movedMap.get(item.id) ?? item);
      } else {
        items.value = items.value.filter(
          (item) => !selectedItems.value.has(item.id),
        );
      }
      selectedItems.value = new Set();
      previewItem.value = null;
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function updateFile(
    mediaId: string,
    filename: string,
    altText?: string,
  ): Promise<void> {
    const { update } = provider;
    if (typeof update !== "function") {
      return;
    }

    try {
      const patch: MediaAssetPatch = { filename };
      if (altText !== undefined) {
        patch.alt = altText;
      }
      const updated = await update(mediaId, patch);
      items.value = items.value.map((item) =>
        item.id === mediaId ? updated : item,
      );
      if (previewItem.value?.id === mediaId) {
        previewItem.value = updated;
      }
      notify(() => provider.onUpdated?.(updated));
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  function captureLocalAssets(ids: string[]): MediaAsset[] {
    const captured = new Map<string, MediaAsset>();
    for (const item of items.value) {
      if (ids.includes(item.id)) {
        captured.set(item.id, item);
      }
    }
    for (const item of frequentlyUsedItems.value) {
      if (ids.includes(item.id) && !captured.has(item.id)) {
        captured.set(item.id, item);
      }
    }
    return [...captured.values()];
  }

  function dropLocalAssets(ids: string[]): void {
    items.value = items.value.filter((item) => !ids.includes(item.id));
    frequentlyUsedItems.value = frequentlyUsedItems.value.filter(
      (item) => !ids.includes(item.id),
    );
    selectedItems.value = new Set();
    previewItem.value = null;
  }

  async function deleteSelected(): Promise<void> {
    if (selectedItems.value.size === 0) return;

    const { delete: providerDelete } = provider;
    if (typeof providerDelete !== "function") {
      return;
    }

    const ids = [...selectedItems.value];
    const captured = captureLocalAssets(ids);

    try {
      await providerDelete(ids);
      dropLocalAssets(ids);
      for (const asset of captured) {
        notify(() => provider.onDeleted?.(asset));
      }
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function loadFrequentlyUsed(): Promise<void> {
    const { frequentlyUsed } = provider;
    if (typeof frequentlyUsed !== "function") {
      return;
    }

    try {
      frequentlyUsedItems.value = await frequentlyUsed();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function checkUsageBeforeDelete(): Promise<boolean> {
    if (selectedItems.value.size === 0) {
      return false;
    }

    pendingDeleteIds.value = [...selectedItems.value];

    const { checkUsage } = provider;
    if (typeof checkUsage !== "function") {
      deleteUsageInfo.value = {};
      showDeleteWarning.value = true;
      return false;
    }

    try {
      const usage = await checkUsage(pendingDeleteIds.value);
      deleteUsageInfo.value = usage;

      const hasUsage = Object.values(usage).some(
        (info) => info.templateCount > 0,
      );

      showDeleteWarning.value = true;
      return hasUsage;
    } catch (error) {
      options.onError?.(error as Error);
      return false;
    }
  }

  async function confirmDelete(): Promise<void> {
    const { delete: providerDelete } = provider;
    if (typeof providerDelete !== "function") {
      return;
    }

    showDeleteWarning.value = false;

    if (pendingDeleteIds.value.length === 0) {
      return;
    }

    const ids = pendingDeleteIds.value;
    const captured = captureLocalAssets(ids);

    try {
      await providerDelete(ids);
      dropLocalAssets(ids);
      pendingDeleteIds.value = [];
      deleteUsageInfo.value = {};
      for (const asset of captured) {
        notify(() => provider.onDeleted?.(asset));
      }
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  function cancelDelete(): void {
    showDeleteWarning.value = false;
    pendingDeleteIds.value = [];
    deleteUsageInfo.value = {};
  }

  async function importFromUrl(url: string): Promise<MediaAsset | null> {
    const importUrl = provider.importFromUrl;
    if (typeof importUrl !== "function") {
      return null;
    }

    isImportingFromUrl.value = true;
    importFromUrlError.value = null;
    try {
      const media = await importUrl(
        url,
        currentFolderId.value,
        resolvedTemplateId(),
      );
      items.value = [media, ...items.value];
      notify(() => provider.onCreated?.(media));
      return media;
    } catch (error) {
      importFromUrlError.value =
        error instanceof Error ? error.message : "Import failed";
      options.onError?.(error as Error);
      return null;
    } finally {
      isImportingFromUrl.value = false;
    }
  }

  function toggleSelection(id: string): void {
    const next = new Set(selectedItems.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedItems.value = next;
  }

  function clearSelection(): void {
    selectedItems.value = new Set();
    previewItem.value = null;
  }

  function selectItem(item: MediaAsset): void {
    previewItem.value = item;
    selectedItems.value = new Set([item.id]);
  }

  async function loadStorage(): Promise<void> {
    const { storage } = provider;
    if (typeof storage !== "function") {
      storageInfo.value = null;
      return;
    }

    try {
      storageInfo.value = await storage();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function loadFolders(): Promise<void> {
    const foldersApi = foldersProvider();
    if (!foldersApi) {
      return;
    }

    try {
      folders.value = await foldersApi.list();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function createFolder(
    name: string,
    parentId?: string | null,
  ): Promise<MediaFolder | null> {
    const foldersApi = foldersProvider();
    const { create } = foldersApi ?? { create: false };
    if (typeof create !== "function") {
      return null;
    }

    try {
      const input: MediaFolderInput = { name };
      if (parentId !== undefined) {
        input.parentId = parentId;
      }
      const folder = await create(input);
      await loadFolders();
      return folder;
    } catch (error) {
      options.onError?.(error as Error);
      return null;
    }
  }

  function findFolderInTree(
    folderList: MediaFolder[],
    id: string,
  ): MediaFolder | null {
    for (const folder of folderList) {
      if (folder.id === id) return folder;
    }
    return null;
  }

  async function renameFolder(folderId: string, name: string): Promise<void> {
    const foldersApi = foldersProvider();
    const { update } = foldersApi ?? { update: false };
    if (typeof update !== "function") {
      return;
    }

    try {
      await update(folderId, { name });
      await loadFolders();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function deleteFolder(folderId: string): Promise<void> {
    const foldersApi = foldersProvider();
    const { delete: deleteFn } = foldersApi ?? { delete: false };
    if (typeof deleteFn !== "function") {
      return;
    }

    try {
      const folder = findFolderInTree(folders.value, folderId);
      const parentId = folder?.parentId ?? null;

      await deleteFn(folderId);

      if (currentFolderId.value === folderId) {
        currentFolderId.value = parentId;
      }

      await loadFolders();
      await loadItems();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function checkUsageBeforeReplace(item: MediaAsset): Promise<void> {
    pendingReplaceItem.value = item;
    replaceError.value = null;

    const { checkUsage } = provider;
    if (typeof checkUsage !== "function") {
      replaceUsageInfo.value = null;
      showReplaceWarning.value = true;
      return;
    }

    try {
      const usage = await checkUsage([item.id]);
      replaceUsageInfo.value = usage[item.id] ?? null;
      showReplaceWarning.value = true;
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  function cancelReplace(): void {
    showReplaceWarning.value = false;
    pendingReplaceItem.value = null;
    replaceUsageInfo.value = null;
    replaceError.value = null;
  }

  function applyReplaced(updated: MediaAsset): void {
    items.value = items.value.map((item) =>
      item.id === updated.id ? updated : item,
    );

    frequentlyUsedItems.value = frequentlyUsedItems.value.map((item) =>
      item.id === updated.id ? updated : item,
    );

    if (previewItem.value?.id === updated.id) {
      previewItem.value = updated;
    }

    notify(() => provider.onUpdated?.(updated));
  }

  async function replaceFile(file: File): Promise<MediaAsset | null> {
    const { replace } = provider;
    if (typeof replace !== "function" || !pendingReplaceItem.value) {
      return null;
    }

    isReplacing.value = true;
    replaceError.value = null;

    try {
      const updated = await replace(pendingReplaceItem.value.id, file);
      applyReplaced(updated);

      showReplaceWarning.value = false;
      pendingReplaceItem.value = null;
      replaceUsageInfo.value = null;

      return updated;
    } catch (error) {
      replaceError.value =
        error instanceof Error ? error.message : "Replace failed";
      options.onError?.(error as Error);
      return null;
    } finally {
      isReplacing.value = false;
    }
  }

  async function replaceMediaDirectly(
    mediaId: string,
    file: File,
  ): Promise<MediaAsset | null> {
    const { replace } = provider;
    if (typeof replace !== "function") {
      return null;
    }

    try {
      const updated = await replace(mediaId, file);
      applyReplaced(updated);
      return updated;
    } catch (error) {
      options.onError?.(error as Error);
      return null;
    }
  }

  return {
    items,
    folders,
    currentFolderId,
    viewMode,
    searchQuery,
    categoryFilter,
    sortOption,
    isLoading,
    isUploading,
    uploadProgress,
    hasMore,
    selectedItems,
    previewItem,
    frequentlyUsedItems,
    deleteUsageInfo,
    showDeleteWarning,
    loadItems,
    loadMore,
    search,
    filterByCategory,
    sortBy,
    navigateToFolder,
    showFrequentlyUsed,
    uploadFile,
    uploadFiles,
    moveSelected,
    updateFile,
    deleteSelected,
    isImportingFromUrl,
    importFromUrlError,
    importFromUrl,
    toggleSelection,
    clearSelection,
    selectItem,
    loadFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    findFolderInTree,
    loadFrequentlyUsed,
    checkUsageBeforeDelete,
    confirmDelete,
    cancelDelete,
    isReplacing,
    replaceError,
    showReplaceWarning,
    pendingReplaceItem,
    replaceUsageInfo,
    checkUsageBeforeReplace,
    cancelReplace,
    replaceFile,
    replaceMediaDirectly,
    storageInfo,
    loadStorage,
  };
}
