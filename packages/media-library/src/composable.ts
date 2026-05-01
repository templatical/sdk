import type { AuthManager } from "@templatical/core/cloud";
import { MediaApiClient } from "./api-client";
import { ref, type Ref } from "vue";
import type { MediaFolder, MediaItem, MediaUsageInfo } from "./types";

export type MediaViewMode = "files" | "frequently-used";

export interface UseMediaLibraryOptions {
  projectId: string;
  authManager: AuthManager;
  onError?: (error: Error) => void;
}

export function useMediaLibrary(options: UseMediaLibraryOptions) {
  if (!options.projectId) {
    throw new Error("projectId is required for useMediaLibrary");
  }

  const api = new MediaApiClient(options.authManager);

  const items: Ref<MediaItem[]> = ref([]);
  const folders: Ref<MediaFolder[]> = ref([]);
  const currentFolderId: Ref<string | null> = ref(null);
  const viewMode: Ref<MediaViewMode> = ref("files");
  const searchQuery: Ref<string> = ref("");
  const categoryFilter: Ref<string | null> = ref(null);
  const sortOption: Ref<string> = ref("newest");
  const isLoading = ref(false);
  const isUploading = ref(false);
  const hasMore = ref(false);
  const nextCursor: Ref<string | null> = ref(null);
  const uploadProgress: Ref<{ current: number; total: number } | null> =
    ref(null);
  const selectedItems: Ref<Set<string>> = ref(new Set());
  const previewItem: Ref<MediaItem | null> = ref(null);
  const frequentlyUsedItems: Ref<MediaItem[]> = ref([]);
  const deleteUsageInfo: Ref<Record<string, MediaUsageInfo>> = ref({});
  const showDeleteWarning = ref(false);
  const pendingDeleteIds: Ref<string[]> = ref([]);
  const isImportingFromUrl = ref(false);
  const importFromUrlError: Ref<string | null> = ref(null);
  const isReplacing = ref(false);
  const replaceError: Ref<string | null> = ref(null);
  const showReplaceWarning = ref(false);
  const pendingReplaceItem: Ref<MediaItem | null> = ref(null);
  const replaceUsageInfo: Ref<MediaUsageInfo | null> = ref(null);

  // Monotonic token so out-of-order browseMedia responses (folder switch /
  // search change before the previous request settled) don't overwrite the
  // current view with stale data.
  let browseRequestId = 0;

  async function loadItems(): Promise<void> {
    const requestId = ++browseRequestId;
    isLoading.value = true;
    try {
      const response = await api.browseMedia({
        folder_id: searchQuery.value ? undefined : currentFolderId.value,
        search: searchQuery.value || undefined,
        category: categoryFilter.value || undefined,
        sort: sortOption.value !== "newest" ? sortOption.value : undefined,
      });
      if (requestId !== browseRequestId) return;
      items.value = response.data;
      nextCursor.value = response.meta.next_cursor;
      hasMore.value = !!response.meta.next_cursor;
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
    try {
      const response = await api.browseMedia({
        folder_id: searchQuery.value ? undefined : currentFolderId.value,
        search: searchQuery.value || undefined,
        category: categoryFilter.value || undefined,
        sort: sortOption.value !== "newest" ? sortOption.value : undefined,
        cursor: nextCursor.value,
      });
      if (requestId !== browseRequestId) return;
      items.value = [...items.value, ...response.data];
      nextCursor.value = response.meta.next_cursor;
      hasMore.value = !!response.meta.next_cursor;
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

  async function filterByCategory(category: string | null): Promise<void> {
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

  async function uploadFile(file: File): Promise<MediaItem | null> {
    isUploading.value = true;
    try {
      const media = await api.uploadMedia(file, currentFolderId.value);
      items.value = [media, ...items.value];
      return media;
    } catch (error) {
      options.onError?.(error as Error);
      return null;
    } finally {
      isUploading.value = false;
    }
  }

  async function uploadFiles(files: File[]): Promise<void> {
    isUploading.value = true;
    uploadProgress.value = { current: 0, total: files.length };
    try {
      for (let i = 0; i < files.length; i++) {
        uploadProgress.value = { current: i + 1, total: files.length };
        try {
          const media = await api.uploadMedia(files[i], currentFolderId.value);
          items.value = [media, ...items.value];
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

    try {
      const movedItems = await api.moveMedia(
        [...selectedItems.value],
        targetFolderId,
      );
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
    try {
      const updated = await api.updateMedia(mediaId, filename, altText);
      items.value = items.value.map((item) =>
        item.id === mediaId ? updated : item,
      );
      if (previewItem.value?.id === mediaId) {
        previewItem.value = updated;
      }
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function deleteSelected(): Promise<void> {
    if (selectedItems.value.size === 0) return;

    try {
      await api.deleteMedia([...selectedItems.value]);
      items.value = items.value.filter(
        (item) => !selectedItems.value.has(item.id),
      );
      frequentlyUsedItems.value = frequentlyUsedItems.value.filter(
        (item) => !selectedItems.value.has(item.id),
      );
      selectedItems.value = new Set();
      previewItem.value = null;
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function loadFrequentlyUsed(): Promise<void> {
    try {
      frequentlyUsedItems.value = await api.getFrequentlyUsed();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function checkUsageBeforeDelete(): Promise<boolean> {
    if (selectedItems.value.size === 0) {
      return false;
    }

    pendingDeleteIds.value = [...selectedItems.value];

    try {
      const response = await api.checkMediaUsage(pendingDeleteIds.value);
      deleteUsageInfo.value = response.data;

      const hasUsage = Object.values(response.data).some(
        (info) => info.template_count > 0,
      );

      showDeleteWarning.value = true;
      return hasUsage;
    } catch (error) {
      options.onError?.(error as Error);
      return false;
    }
  }

  async function confirmDelete(): Promise<void> {
    showDeleteWarning.value = false;

    if (pendingDeleteIds.value.length === 0) {
      return;
    }

    try {
      await api.deleteMedia(pendingDeleteIds.value);
      items.value = items.value.filter(
        (item) => !pendingDeleteIds.value.includes(item.id),
      );
      frequentlyUsedItems.value = frequentlyUsedItems.value.filter(
        (item) => !pendingDeleteIds.value.includes(item.id),
      );
      selectedItems.value = new Set();
      previewItem.value = null;
      pendingDeleteIds.value = [];
      deleteUsageInfo.value = {};
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  function cancelDelete(): void {
    showDeleteWarning.value = false;
    pendingDeleteIds.value = [];
    deleteUsageInfo.value = {};
  }

  async function importFromUrl(url: string): Promise<MediaItem | null> {
    isImportingFromUrl.value = true;
    importFromUrlError.value = null;
    try {
      const media = await api.importFromUrl(url, currentFolderId.value);
      items.value = [media, ...items.value];
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

  function selectItem(item: MediaItem): void {
    previewItem.value = item;
    selectedItems.value = new Set([item.id]);
  }

  async function loadFolders(): Promise<void> {
    try {
      folders.value = await api.getMediaFolders();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function createFolder(
    name: string,
    parentId?: string | null,
  ): Promise<MediaFolder | null> {
    try {
      const folder = await api.createMediaFolder(name, parentId);
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
      if (folder.children) {
        const found = findFolderInTree(folder.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  async function renameFolder(folderId: string, name: string): Promise<void> {
    try {
      await api.renameMediaFolder(folderId, name);
      await loadFolders();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function deleteFolder(folderId: string): Promise<void> {
    try {
      const folder = findFolderInTree(folders.value, folderId);
      const parentId = folder?.parent_id ?? null;

      await api.deleteMediaFolder(folderId);

      if (currentFolderId.value === folderId) {
        currentFolderId.value = parentId;
      }

      await loadFolders();
      await loadItems();
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  async function checkUsageBeforeReplace(item: MediaItem): Promise<void> {
    pendingReplaceItem.value = item;
    replaceError.value = null;

    try {
      const response = await api.checkMediaUsage([item.id]);
      replaceUsageInfo.value = response.data[item.id] ?? null;
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

  async function replaceFile(file: File): Promise<MediaItem | null> {
    if (!pendingReplaceItem.value) {
      return null;
    }

    isReplacing.value = true;
    replaceError.value = null;

    try {
      const updated = await api.replaceMedia(pendingReplaceItem.value.id, file);

      items.value = items.value.map((item) =>
        item.id === updated.id ? updated : item,
      );

      frequentlyUsedItems.value = frequentlyUsedItems.value.map((item) =>
        item.id === updated.id ? updated : item,
      );

      if (previewItem.value?.id === updated.id) {
        previewItem.value = updated;
      }

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
  ): Promise<MediaItem | null> {
    try {
      const updated = await api.replaceMedia(mediaId, file);

      items.value = items.value.map((item) =>
        item.id === updated.id ? updated : item,
      );

      frequentlyUsedItems.value = frequentlyUsedItems.value.map((item) =>
        item.id === updated.id ? updated : item,
      );

      if (previewItem.value?.id === updated.id) {
        previewItem.value = updated;
      }

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
  };
}
