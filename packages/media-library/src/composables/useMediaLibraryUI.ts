import type { CropData } from "../components/media/MediaEditModal.vue";
import type { MediaConversion, MediaItem } from "../types";
import type { useMediaLibrary } from "../composable";

type UseMediaLibraryReturn = ReturnType<typeof useMediaLibrary>;
import { useClipboard, useDebounceFn } from "@vueuse/core";
import { computed, ref, watch, type ComputedRef, type Ref } from "vue";

export interface UseMediaLibraryUIOptions {
  library: UseMediaLibraryReturn;
  canUseMediaFolders: ComputedRef<boolean>;
  translations:
    | { mediaLibrary: Record<string, string> }
    | Ref<{ mediaLibrary: Record<string, string> }>;
}

export interface UseMediaLibraryUIReturn {
  // UI state
  layoutMode: Ref<"grid" | "list">;
  showSidebar: Ref<boolean>;
  searchInput: Ref<string>;
  selectedConversion: Ref<MediaConversion>;
  editingItem: Ref<MediaItem | null>;
  showImportUrlModal: Ref<boolean>;
  showMovePicker: Ref<boolean>;

  // Derived state
  selectedUrl: ComputedRef<string | null>;
  hasFrequentlyUsed: ComputedRef<boolean>;
  displayItems: ComputedRef<MediaItem[]>;
  hasUsedFiles: ComputedRef<boolean>;

  // Clipboard
  copy: (text: string) => Promise<void>;
  copied: Ref<boolean>;

  // Category labels
  getCategoryLabel: (category: string) => string;

  // Handlers
  handleSearchInput: (value: string) => void;
  handleUpload: (files: File[]) => Promise<void>;
  handleSelect: (item: MediaItem) => void;
  handleCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  handleRenameFolder: (folderId: string, name: string) => Promise<void>;
  handleDeleteFolder: (folderId: string) => Promise<void>;
  handleEditItem: (item: MediaItem) => void;
  handleEditSave: (
    mediaId: string,
    filename: string,
    altText?: string,
    cropData?: CropData,
  ) => Promise<void>;
  handleImportFromUrl: (url: string) => Promise<void>;
  handleMoveToFolder: (folderId: string | null) => Promise<void>;
  handleDeleteClick: () => Promise<void>;
  handleReplaceItem: (item: MediaItem) => void;
  handleReplaceFile: (file: File) => Promise<void>;

  // Reset (used by modal when closing)
  resetUI: () => void;
}

export function useMediaLibraryUI(
  options: UseMediaLibraryUIOptions,
): UseMediaLibraryUIReturn {
  const { library, canUseMediaFolders, translations } = options;

  function getTranslations() {
    if ("value" in translations && typeof translations.value === "object") {
      return (translations as Ref<{ mediaLibrary: Record<string, string> }>)
        .value;
    }
    return translations as { mediaLibrary: Record<string, string> };
  }

  // --- UI state ---
  const layoutMode = ref<"grid" | "list">("grid");
  const showSidebar = ref(false);
  const searchInput = ref("");
  const selectedConversion = ref<MediaConversion>("original");
  const editingItem = ref<MediaItem | null>(null);
  const showImportUrlModal = ref(false);
  const showMovePicker = ref(false);

  // --- Derived state ---
  const selectedUrl = computed(() => {
    const item = library.previewItem.value;
    if (!item) return null;

    switch (selectedConversion.value) {
      case "small":
        return item.small_url || item.url;
      case "medium":
        return item.medium_url || item.url;
      case "large":
        return item.large_url || item.url;
      default:
        return item.url;
    }
  });

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
      (info) => info.template_count > 0,
    );
  });

  // --- Category labels ---
  const categoryLabels: Record<string, () => string> = {
    images: () => getTranslations().mediaLibrary.filterImages,
    documents: () => getTranslations().mediaLibrary.filterDocuments,
    videos: () => getTranslations().mediaLibrary.filterVideos,
    audio: () => getTranslations().mediaLibrary.filterAudio,
  };

  function getCategoryLabel(category: string): string {
    return categoryLabels[category]?.() ?? category;
  }

  // --- Watchers ---
  watch(showSidebar, (show) => {
    if (show && canUseMediaFolders.value) {
      library.loadFolders();
    }
  });

  watch(
    () => library.previewItem.value?.id,
    () => {
      selectedConversion.value = "original";
    },
  );

  // --- Search ---
  const debouncedSearch = useDebounceFn((value: string) => {
    library.search(value);
  }, 300);

  function handleSearchInput(value: string): void {
    searchInput.value = value;
    debouncedSearch(value);
  }

  // --- Clipboard ---
  const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true });

  // --- Handlers ---
  async function handleUpload(files: File[]): Promise<void> {
    await library.uploadFiles(files);
  }

  function handleSelect(item: MediaItem): void {
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

  function handleEditItem(item: MediaItem): void {
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

  function handleReplaceItem(item: MediaItem): void {
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
    library.categoryFilter.value = null;
    library.sortOption.value = "newest";
    library.viewMode.value = "files";
    editingItem.value = null;
    showImportUrlModal.value = false;
    selectedConversion.value = "original";
  }

  return {
    layoutMode,
    showSidebar,
    searchInput,
    selectedConversion,
    editingItem,
    showImportUrlModal,
    showMovePicker,
    selectedUrl,
    hasFrequentlyUsed,
    displayItems,
    hasUsedFiles,
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
