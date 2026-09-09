import type { CropData } from "../components/media/MediaEditModal.vue";
import type { MediaAsset } from "@templatical/types";
import type { useMediaLibrary } from "../composable";
import { treeFolders, type MediaFolderNode } from "../utils/treeFolders";

type UseMediaLibraryReturn = ReturnType<typeof useMediaLibrary>;
import { useClipboard, useDebounceFn } from "@vueuse/core";
import { computed, ref, watch, type ComputedRef, type Ref } from "vue";

export interface UseMediaLibraryUIOptions {
  library: UseMediaLibraryReturn;
  translations:
    | { mediaLibrary: Record<string, string> }
    | Ref<{ mediaLibrary: Record<string, string> }>;
}

export interface UseMediaLibraryUIReturn {
  layoutMode: Ref<"grid" | "list">;
  showSidebar: Ref<boolean>;
  searchInput: Ref<string>;
  editingItem: Ref<MediaAsset | null>;
  showImportUrlModal: Ref<boolean>;
  showMovePicker: Ref<boolean>;

  selectedUrl: ComputedRef<string | null>;
  hasFrequentlyUsed: ComputedRef<boolean>;
  displayItems: ComputedRef<MediaAsset[]>;
  hasUsedFiles: ComputedRef<boolean>;
  folderTree: ComputedRef<MediaFolderNode[]>;

  copy: (text: string) => Promise<void>;
  copied: Ref<boolean>;

  getCategoryLabel: (category: string) => string;

  handleSearchInput: (value: string) => void;
  handleUpload: (files: File[]) => Promise<void>;
  handleSelect: (item: MediaAsset) => void;
  handleCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  handleRenameFolder: (folderId: string, name: string) => Promise<void>;
  handleDeleteFolder: (folderId: string) => Promise<void>;
  handleEditItem: (item: MediaAsset) => void;
  handleEditSave: (
    mediaId: string,
    filename: string,
    altText?: string,
    cropData?: CropData,
  ) => Promise<void>;
  handleImportFromUrl: (url: string) => Promise<void>;
  handleMoveToFolder: (folderId: string | null) => Promise<void>;
  handleDeleteClick: () => Promise<void>;
  handleReplaceItem: (item: MediaAsset) => void;
  handleReplaceFile: (file: File) => Promise<void>;

  resetUI: () => void;
}

export function useMediaLibraryUI(
  options: UseMediaLibraryUIOptions,
): UseMediaLibraryUIReturn {
  const { library, translations } = options;

  function getTranslations() {
    if ("value" in translations && typeof translations.value === "object") {
      return (translations as Ref<{ mediaLibrary: Record<string, string> }>)
        .value;
    }
    return translations as { mediaLibrary: Record<string, string> };
  }

  const layoutMode = ref<"grid" | "list">("grid");
  const showSidebar = ref(false);
  const searchInput = ref("");
  const editingItem = ref<MediaAsset | null>(null);
  const showImportUrlModal = ref(false);
  const showMovePicker = ref(false);

  const selectedUrl = computed(() => library.previewItem.value?.url ?? null);

  const hasFrequentlyUsed = computed(() => {
    return library.frequentlyUsedItems.value.length > 0;
  });

  const displayItems = computed(() => {
    if (library.viewMode.value === "frequently-used") {
      return library.frequentlyUsedItems.value;
    }
    return library.items.value;
  });

  const hasUsedFiles = computed(() => {
    return Object.values(library.deleteUsageInfo.value).some(
      (info) => info.templateCount > 0,
    );
  });

  const folderTree = computed(() => treeFolders(library.folders.value));

  const categoryLabels: Record<string, () => string> = {
    images: () => getTranslations().mediaLibrary.filterImages,
    documents: () => getTranslations().mediaLibrary.filterDocuments,
    videos: () => getTranslations().mediaLibrary.filterVideos,
    audio: () => getTranslations().mediaLibrary.filterAudio,
  };

  function getCategoryLabel(category: string): string {
    return categoryLabels[category]?.() ?? category;
  }

  watch(showSidebar, (show) => {
    if (show) {
      library.loadFolders();
    }
  });

  const debouncedSearch = useDebounceFn((value: string) => {
    library.search(value);
  }, 300);

  function handleSearchInput(value: string): void {
    searchInput.value = value;
    debouncedSearch(value);
  }

  const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true });

  async function handleUpload(files: File[]): Promise<void> {
    await library.uploadFiles(files);
  }

  function handleSelect(item: MediaAsset): void {
    library.selectItem(item);
  }

  async function handleCreateFolder(
    name: string,
    parentId?: string | null,
  ): Promise<void> {
    await library.createFolder(name, parentId);
  }

  async function handleRenameFolder(
    folderId: string,
    name: string,
  ): Promise<void> {
    await library.renameFolder(folderId, name);
  }

  async function handleDeleteFolder(folderId: string): Promise<void> {
    await library.deleteFolder(folderId);
  }

  function handleEditItem(item: MediaAsset): void {
    editingItem.value = item;
  }

  async function handleEditSave(
    mediaId: string,
    filename: string,
    altText?: string,
    cropData?: CropData,
  ): Promise<void> {
    if (cropData) {
      await library.replaceMediaDirectly(mediaId, cropData.file);
    }
    await library.updateFile(mediaId, filename, altText);
    editingItem.value = null;
  }

  async function handleImportFromUrl(url: string): Promise<void> {
    const result = await library.importFromUrl(url);
    if (result) {
      showImportUrlModal.value = false;
    }
  }

  async function handleMoveToFolder(folderId: string | null): Promise<void> {
    showMovePicker.value = false;
    await library.moveSelected(folderId);
  }

  async function handleDeleteClick(): Promise<void> {
    await library.checkUsageBeforeDelete();
  }

  function handleReplaceItem(item: MediaAsset): void {
    library.checkUsageBeforeReplace(item);
  }

  async function handleReplaceFile(file: File): Promise<void> {
    await library.replaceFile(file);
  }

  function resetUI(): void {
    library.clearSelection();
    library.cancelDelete();
    library.cancelReplace();
    searchInput.value = "";
    // Assign, don't `search("")`: that would list on close. The next open
    // already calls `loadItems()` with whatever `searchQuery` holds.
    library.searchQuery.value = "";
    library.categoryFilter.value = null;
    library.sortOption.value = "newest";
    library.viewMode.value = "files";
    editingItem.value = null;
    showImportUrlModal.value = false;
  }

  return {
    layoutMode,
    showSidebar,
    searchInput,
    editingItem,
    showImportUrlModal,
    showMovePicker,
    selectedUrl,
    hasFrequentlyUsed,
    displayItems,
    hasUsedFiles,
    folderTree,
    copy,
    copied,
    getCategoryLabel,
    handleSearchInput,
    handleUpload,
    handleSelect,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleEditItem,
    handleEditSave,
    handleImportFromUrl,
    handleMoveToFolder,
    handleDeleteClick,
    handleReplaceItem,
    handleReplaceFile,
    resetUI,
  };
}
