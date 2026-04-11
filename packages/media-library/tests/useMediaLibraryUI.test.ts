import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { useMediaLibraryUI } from "../src/composables/useMediaLibraryUI";
import type { MediaItem } from "../src/types";

// Minimal mock for useClipboard
vi.mock("@vueuse/core", () => ({
  useClipboard: () => ({
    copy: vi.fn(),
    copied: ref(false),
  }),
  useDebounceFn: (fn: Function) => fn,
}));

function createMediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "m1",
    filename: "photo.jpg",
    mime_type: "image/jpeg",
    size: 1024,
    url: "https://cdn.test/photo.jpg",
    small_url: "https://cdn.test/photo-small.jpg",
    medium_url: "https://cdn.test/photo-medium.jpg",
    large_url: "https://cdn.test/photo-large.jpg",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as MediaItem;
}

function createMockLibrary() {
  return {
    items: ref<MediaItem[]>([]),
    folders: ref([]),
    currentFolderId: ref<string | null>(null),
    viewMode: ref<"files" | "frequently-used">("files"),
    searchQuery: ref(""),
    categoryFilter: ref<string | null>(null),
    sortOption: ref("newest"),
    isLoading: ref(false),
    isUploading: ref(false),
    uploadProgress: ref(null),
    hasMore: ref(false),
    selectedItems: ref(new Set<string>()),
    previewItem: ref<MediaItem | null>(null),
    frequentlyUsedItems: ref<MediaItem[]>([]),
    deleteUsageInfo: ref({}),
    showDeleteWarning: ref(false),
    isImportingFromUrl: ref(false),
    importFromUrlError: ref(null),
    isReplacing: ref(false),
    replaceError: ref(null),
    showReplaceWarning: ref(false),
    pendingReplaceItem: ref(null),
    replaceUsageInfo: ref(null),
    loadItems: vi.fn(),
    loadMore: vi.fn(),
    search: vi.fn(),
    filterByCategory: vi.fn(),
    sortBy: vi.fn(),
    navigateToFolder: vi.fn(),
    showFrequentlyUsed: vi.fn(),
    uploadFile: vi.fn(),
    uploadFiles: vi.fn(),
    moveSelected: vi.fn(),
    updateFile: vi.fn(),
    deleteSelected: vi.fn(),
    loadFrequentlyUsed: vi.fn(),
    checkUsageBeforeDelete: vi.fn(),
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
    importFromUrl: vi.fn(),
    toggleSelection: vi.fn(),
    clearSelection: vi.fn(),
    selectItem: vi.fn(),
    loadFolders: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
    findFolderInTree: vi.fn(),
    checkUsageBeforeReplace: vi.fn(),
    cancelReplace: vi.fn(),
    replaceFile: vi.fn(),
    replaceMediaDirectly: vi.fn(),
  };
}

function createUI(libraryOverride?: ReturnType<typeof createMockLibrary>) {
  const library = libraryOverride ?? createMockLibrary();
  const translations = {
    mediaLibrary: {
      filterImages: "Images",
      filterDocuments: "Documents",
      filterVideos: "Videos",
      filterAudio: "Audio",
    },
  };

  const ui = useMediaLibraryUI({
    library: library as any,
    canUseMediaFolders: computed(() => true),
    translations,
  });

  return { ui, library };
}

describe("useMediaLibraryUI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("initializes with default values", () => {
      const { ui } = createUI();

      expect(ui.layoutMode.value).toBe("grid");
      expect(ui.showSidebar.value).toBe(false);
      expect(ui.searchInput.value).toBe("");
      expect(ui.selectedConversion.value).toBe("original");
      expect(ui.editingItem.value).toBeNull();
      expect(ui.showImportUrlModal.value).toBe(false);
      expect(ui.showMovePicker.value).toBe(false);
    });
  });

  describe("selectedUrl", () => {
    it("returns null when no preview item", () => {
      const { ui } = createUI();
      expect(ui.selectedUrl.value).toBeNull();
    });

    it("returns original url by default", () => {
      const library = createMockLibrary();
      library.previewItem.value = createMediaItem();
      const { ui } = createUI(library);

      expect(ui.selectedUrl.value).toBe("https://cdn.test/photo.jpg");
    });

    it("returns small url when small conversion selected", () => {
      const library = createMockLibrary();
      library.previewItem.value = createMediaItem();
      const { ui } = createUI(library);

      ui.selectedConversion.value = "small";
      expect(ui.selectedUrl.value).toBe("https://cdn.test/photo-small.jpg");
    });

    it("returns medium url when medium conversion selected", () => {
      const library = createMockLibrary();
      library.previewItem.value = createMediaItem();
      const { ui } = createUI(library);

      ui.selectedConversion.value = "medium";
      expect(ui.selectedUrl.value).toBe("https://cdn.test/photo-medium.jpg");
    });

    it("returns large url when large conversion selected", () => {
      const library = createMockLibrary();
      library.previewItem.value = createMediaItem();
      const { ui } = createUI(library);

      ui.selectedConversion.value = "large";
      expect(ui.selectedUrl.value).toBe("https://cdn.test/photo-large.jpg");
    });

    it("falls back to original url when conversion url is empty", () => {
      const library = createMockLibrary();
      library.previewItem.value = createMediaItem({ small_url: "" });
      const { ui } = createUI(library);

      ui.selectedConversion.value = "small";
      expect(ui.selectedUrl.value).toBe("https://cdn.test/photo.jpg");
    });
  });

  describe("displayItems", () => {
    it("returns items in files mode", () => {
      const library = createMockLibrary();
      const items = [createMediaItem({ id: "1" }), createMediaItem({ id: "2" })];
      library.items.value = items;
      const { ui } = createUI(library);

      expect(ui.displayItems.value).toEqual(items);
    });

    it("returns frequently used items in frequently-used mode", () => {
      const library = createMockLibrary();
      const freq = [createMediaItem({ id: "freq1" })];
      library.frequentlyUsedItems.value = freq;
      library.viewMode.value = "frequently-used";
      const { ui } = createUI(library);

      expect(ui.displayItems.value).toEqual(freq);
    });
  });

  describe("hasFrequentlyUsed", () => {
    it("returns false when no frequently used items", () => {
      const { ui } = createUI();
      expect(ui.hasFrequentlyUsed.value).toBe(false);
    });

    it("returns true when frequently used items exist", () => {
      const library = createMockLibrary();
      library.frequentlyUsedItems.value = [createMediaItem()];
      const { ui } = createUI(library);

      expect(ui.hasFrequentlyUsed.value).toBe(true);
    });
  });

  describe("hasUsedFiles", () => {
    it("returns false when no usage info", () => {
      const { ui } = createUI();
      expect(ui.hasUsedFiles.value).toBe(false);
    });

    it("returns true when files are used in templates", () => {
      const library = createMockLibrary();
      library.deleteUsageInfo.value = {
        m1: { template_count: 3 },
      } as any;
      const { ui } = createUI(library);

      expect(ui.hasUsedFiles.value).toBe(true);
    });

    it("returns false when template_count is 0", () => {
      const library = createMockLibrary();
      library.deleteUsageInfo.value = {
        m1: { template_count: 0 },
      } as any;
      const { ui } = createUI(library);

      expect(ui.hasUsedFiles.value).toBe(false);
    });
  });

  describe("getCategoryLabel", () => {
    it("returns translated label for known categories", () => {
      const { ui } = createUI();
      expect(ui.getCategoryLabel("images")).toBe("Images");
      expect(ui.getCategoryLabel("documents")).toBe("Documents");
      expect(ui.getCategoryLabel("videos")).toBe("Videos");
      expect(ui.getCategoryLabel("audio")).toBe("Audio");
    });

    it("returns raw category for unknown categories", () => {
      const { ui } = createUI();
      expect(ui.getCategoryLabel("custom")).toBe("custom");
    });
  });

  describe("handlers", () => {
    it("handleSearchInput updates searchInput and calls library.search", () => {
      const { ui, library } = createUI();
      ui.handleSearchInput("test query");

      expect(ui.searchInput.value).toBe("test query");
      expect(library.search).toHaveBeenCalledWith("test query");
    });

    it("handleUpload delegates to library.uploadFiles", async () => {
      const { ui, library } = createUI();
      const files = [new File([""], "test.jpg")];
      await ui.handleUpload(files);

      expect(library.uploadFiles).toHaveBeenCalledWith(files);
    });

    it("handleSelect delegates to library.selectItem", () => {
      const { ui, library } = createUI();
      const item = createMediaItem();
      ui.handleSelect(item);

      expect(library.selectItem).toHaveBeenCalledWith(item);
    });

    it("handleCreateFolder delegates to library.createFolder", async () => {
      const { ui, library } = createUI();
      await ui.handleCreateFolder("New Folder", "parent-1");

      expect(library.createFolder).toHaveBeenCalledWith("New Folder", "parent-1");
    });

    it("handleRenameFolder delegates to library.renameFolder", async () => {
      const { ui, library } = createUI();
      await ui.handleRenameFolder("f1", "Renamed");

      expect(library.renameFolder).toHaveBeenCalledWith("f1", "Renamed");
    });

    it("handleDeleteFolder delegates to library.deleteFolder", async () => {
      const { ui, library } = createUI();
      await ui.handleDeleteFolder("f1");

      expect(library.deleteFolder).toHaveBeenCalledWith("f1");
    });

    it("handleEditItem sets editingItem", () => {
      const { ui } = createUI();
      const item = createMediaItem();
      ui.handleEditItem(item);

      expect(ui.editingItem.value).toEqual(item);
    });

    it("handleEditSave updates file and clears editingItem", async () => {
      const { ui, library } = createUI();
      ui.editingItem.value = createMediaItem();

      await ui.handleEditSave("m1", "renamed.jpg", "alt text");

      expect(library.updateFile).toHaveBeenCalledWith("m1", "renamed.jpg", "alt text");
      expect(ui.editingItem.value).toBeNull();
    });

    it("handleEditSave replaces media when cropData provided", async () => {
      const { ui, library } = createUI();
      ui.editingItem.value = createMediaItem();
      const cropFile = new File([""], "cropped.jpg");

      await ui.handleEditSave("m1", "photo.jpg", undefined, { file: cropFile } as any);

      expect(library.replaceMediaDirectly).toHaveBeenCalledWith("m1", cropFile);
      expect(library.updateFile).toHaveBeenCalledWith("m1", "photo.jpg", undefined);
    });

    it("handleImportFromUrl closes modal on success", async () => {
      const { ui, library } = createUI();
      library.importFromUrl.mockResolvedValue(createMediaItem());
      ui.showImportUrlModal.value = true;

      await ui.handleImportFromUrl("https://example.com/img.jpg");

      expect(ui.showImportUrlModal.value).toBe(false);
    });

    it("handleImportFromUrl keeps modal open on failure", async () => {
      const { ui, library } = createUI();
      library.importFromUrl.mockResolvedValue(null);
      ui.showImportUrlModal.value = true;

      await ui.handleImportFromUrl("https://example.com/bad");

      expect(ui.showImportUrlModal.value).toBe(true);
    });

    it("handleMoveToFolder closes picker and moves", async () => {
      const { ui, library } = createUI();
      ui.showMovePicker.value = true;

      await ui.handleMoveToFolder("folder-1");

      expect(ui.showMovePicker.value).toBe(false);
      expect(library.moveSelected).toHaveBeenCalledWith("folder-1");
    });

    it("handleDeleteClick delegates to library.checkUsageBeforeDelete", async () => {
      const { ui, library } = createUI();
      await ui.handleDeleteClick();

      expect(library.checkUsageBeforeDelete).toHaveBeenCalled();
    });

    it("handleReplaceItem delegates to library.checkUsageBeforeReplace", () => {
      const { ui, library } = createUI();
      const item = createMediaItem();
      ui.handleReplaceItem(item);

      expect(library.checkUsageBeforeReplace).toHaveBeenCalledWith(item);
    });

    it("handleReplaceFile delegates to library.replaceFile", async () => {
      const { ui, library } = createUI();
      const file = new File([""], "replacement.jpg");
      await ui.handleReplaceFile(file);

      expect(library.replaceFile).toHaveBeenCalledWith(file);
    });
  });

  describe("resetUI", () => {
    it("resets all UI state and library filters", () => {
      const { ui, library } = createUI();

      // Set non-default state
      ui.searchInput.value = "query";
      ui.editingItem.value = createMediaItem();
      ui.showImportUrlModal.value = true;
      ui.selectedConversion.value = "small";

      ui.resetUI();

      expect(ui.searchInput.value).toBe("");
      expect(ui.editingItem.value).toBeNull();
      expect(ui.showImportUrlModal.value).toBe(false);
      expect(ui.selectedConversion.value).toBe("original");
      expect(library.clearSelection).toHaveBeenCalled();
      expect(library.cancelDelete).toHaveBeenCalled();
      expect(library.cancelReplace).toHaveBeenCalled();
    });
  });
});
