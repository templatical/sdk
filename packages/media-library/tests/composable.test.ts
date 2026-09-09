import { describe, expect, it, vi } from "vitest";
import { useMediaLibrary } from "../src/composable";
import type {
  MediaAsset,
  MediaFolder,
  MediaFoldersProvider,
  MediaListPage,
  MediaProvider,
} from "@templatical/types";

function createAsset(
  id: string,
  overrides: Partial<MediaAsset> = {},
): MediaAsset {
  return {
    id,
    url: `https://cdn.example.com/${id}.jpg`,
    filename: `file-${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1024,
    width: 800,
    height: 600,
    folderId: null,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    ...overrides,
  };
}

function createFolder(
  id: string,
  name: string,
  parentId: string | null = null,
): MediaFolder {
  return { id, name, parentId };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fakeFolders(
  overrides: Partial<MediaFoldersProvider> = {},
): MediaFoldersProvider {
  return {
    list: vi.fn(async () => []),
    create: vi.fn(async ({ name, parentId }) => ({
      id: "new-folder",
      name,
      parentId: parentId ?? null,
    })),
    update: vi.fn(async (id, { name }) => ({
      id,
      name,
      parentId: null,
    })),
    delete: vi.fn(async () => {}),
    move: vi.fn(async (ids, folderId) =>
      ids.map((id) => createAsset(id, { folderId })),
    ),
    ...overrides,
  };
}

function fakeProvider(overrides: Partial<MediaProvider> = {}): MediaProvider {
  return {
    list: vi.fn(async () => ({ items: [] })),
    create: vi.fn(async ({ file }) =>
      createAsset("uploaded", { url: `https://cdn.example/${file.name}` }),
    ),
    update: vi.fn(async (id, patch) =>
      createAsset(id, { filename: patch.filename, alt: patch.alt }),
    ),
    delete: vi.fn(async () => {}),
    folders: fakeFolders(),
    replace: vi.fn(async (id) => createAsset(id)),
    importFromUrl: vi.fn(async (url) => createAsset("imported", { url })),
    checkUsage: vi.fn(async () => ({})),
    frequentlyUsed: vi.fn(async () => []),
    storage: false,
    ...overrides,
  };
}

describe("useMediaLibrary", () => {
  it("initializes with default state", () => {
    const lib = useMediaLibrary({ provider: fakeProvider() });

    expect(lib.items.value).toEqual([]);
    expect(lib.folders.value).toEqual([]);
    expect(lib.currentFolderId.value).toBeNull();
    expect(lib.viewMode.value).toBe("files");
    expect(lib.searchQuery.value).toBe("");
    expect(lib.categoryFilter.value).toBeNull();
    expect(lib.sortOption.value).toBe("newest");
    expect(lib.isLoading.value).toBe(false);
    expect(lib.isUploading.value).toBe(false);
    expect(lib.hasMore.value).toBe(false);
    expect(lib.selectedItems.value.size).toBe(0);
    expect(lib.previewItem.value).toBeNull();
  });

  describe("stale list / create:false / loadMore", () => {
    it("stale list response does not overwrite a newer one", async () => {
      const first = deferred<MediaListPage>();
      const list = vi
        .fn<MediaProvider["list"]>()
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce({ items: [createAsset("b")] });

      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      const p1 = lib.loadItems();
      const p2 = lib.loadItems();
      await p2;
      first.resolve({ items: [createAsset("a")] });
      await p1;

      expect(lib.items.value.map((item) => item.id)).toEqual(["b"]);
    });

    it("uploadFile returns null and leaves items empty when create is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ create: false }),
      });

      const result = await lib.uploadFile(new File(["x"], "x.jpg"));

      expect(result).toBeNull();
      expect(lib.items.value).toEqual([]);
    });

    it("loadMore appends when nextCursor is set", async () => {
      const list = vi
        .fn<MediaProvider["list"]>()
        .mockResolvedValueOnce({
          items: [createAsset("a")],
          nextCursor: "cursor-1",
        })
        .mockResolvedValueOnce({ items: [createAsset("b")] });

      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();
      await lib.loadMore();

      expect(lib.items.value.map((item) => item.id)).toEqual(["a", "b"]);
    });
  });

  describe("loadItems", () => {
    it("loads items from the provider", async () => {
      const stored = [createAsset("m1"), createAsset("m2")];
      const list = vi.fn(async () => ({ items: stored }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();

      expect(lib.items.value).toEqual(stored);
      expect(lib.hasMore.value).toBe(false);
    });

    it("sets hasMore when nextCursor is present", async () => {
      const list = vi.fn(async () => ({
        items: [createAsset("m1")],
        nextCursor: "next-cursor",
      }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();

      expect(lib.hasMore.value).toBe(true);
    });

    it("manages isLoading state", async () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      const promise = lib.loadItems();
      expect(lib.isLoading.value).toBe(true);

      await promise;
      expect(lib.isLoading.value).toBe(false);
    });

    it("calls onError on failure", async () => {
      const list = vi.fn(async () => {
        throw new Error("Network error");
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ list }),
        onError,
      });

      await lib.loadItems();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(lib.items.value).toEqual([]);
    });

    it("resets isLoading on error", async () => {
      const list = vi.fn(async () => {
        throw new Error("Server error");
      });
      const lib = useMediaLibrary({
        provider: fakeProvider({ list }),
        onError: vi.fn(),
      });

      await lib.loadItems();

      expect(lib.isLoading.value).toBe(false);
    });

    it("omits folderId when search query is set", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      lib.searchQuery.value = "logo";
      lib.currentFolderId.value = "f1";

      await lib.loadItems();

      expect(list).toHaveBeenCalledWith({ search: "logo" });
    });

    it("includes folderId when no search query", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      lib.currentFolderId.value = "f1";

      await lib.loadItems();

      expect(list).toHaveBeenCalledWith({ folderId: "f1" });
    });

    it("does not send sort on list params", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      lib.sortOption.value = "name_asc";

      await lib.loadItems();

      expect(list).toHaveBeenCalledWith({});
      expect(list.mock.calls[0][0]).not.toHaveProperty("sort");
    });

    it("includes category filter when set", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      lib.categoryFilter.value = "images";

      await lib.loadItems();

      expect(list).toHaveBeenCalledWith({ category: "images" });
    });
  });

  describe("loadMore", () => {
    it("does nothing when hasMore is false", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();
      await lib.loadMore();

      expect(list).toHaveBeenCalledTimes(1);
    });

    it("does nothing when already loading", async () => {
      const list = vi.fn(async () => ({
        items: [createAsset("m1")],
        nextCursor: "cursor-1",
      }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();
      lib.isLoading.value = true;
      await lib.loadMore();

      expect(list).toHaveBeenCalledTimes(1);
    });

    it("does nothing when nextCursor is null", async () => {
      const list = vi.fn(async () => ({ items: [createAsset("m1")] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();
      lib.hasMore.value = true;
      await lib.loadMore();

      expect(list).toHaveBeenCalledTimes(1);
    });

    it("passes cursor on the second list call", async () => {
      const list = vi
        .fn<MediaProvider["list"]>()
        .mockResolvedValueOnce({
          items: [createAsset("m1")],
          nextCursor: "cursor-abc",
        })
        .mockResolvedValueOnce({ items: [createAsset("m2")] });
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();
      await lib.loadMore();

      expect(list).toHaveBeenNthCalledWith(2, { cursor: "cursor-abc" });
    });

    it("updates hasMore to false when the next page has no cursor", async () => {
      const list = vi
        .fn<MediaProvider["list"]>()
        .mockResolvedValueOnce({
          items: [createAsset("m1")],
          nextCursor: "cursor-1",
        })
        .mockResolvedValueOnce({ items: [createAsset("m2")] });
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.loadItems();
      expect(lib.hasMore.value).toBe(true);

      await lib.loadMore();

      expect(lib.hasMore.value).toBe(false);
    });

    it("calls onError on failure and leaves the first page in place", async () => {
      const list = vi
        .fn<MediaProvider["list"]>()
        .mockResolvedValueOnce({
          items: [createAsset("m1")],
          nextCursor: "cursor-1",
        })
        .mockRejectedValueOnce(new Error("Load more failed"));
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ list }),
        onError,
      });

      await lib.loadItems();
      await lib.loadMore();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(lib.isLoading.value).toBe(false);
      expect(lib.items.value.map((item) => item.id)).toEqual(["m1"]);
    });
  });

  describe("search, filter, sort", () => {
    it("search updates query and reloads", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.search("logo");

      expect(lib.searchQuery.value).toBe("logo");
      expect(list).toHaveBeenCalledWith({ search: "logo" });
    });

    it("search with empty string clears query", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.search("logo");
      await lib.search("");

      expect(lib.searchQuery.value).toBe("");
      expect(list).toHaveBeenLastCalledWith({});
    });

    it("filterByCategory updates filter and reloads", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.filterByCategory("images");

      expect(lib.categoryFilter.value).toBe("images");
      expect(list).toHaveBeenCalledWith({ category: "images" });
    });

    it("filterByCategory with null clears filter", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.filterByCategory("images");
      await lib.filterByCategory(null);

      expect(lib.categoryFilter.value).toBeNull();
      expect(list).toHaveBeenLastCalledWith({});
    });

    it("sortBy updates option and reloads without sending sort", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      await lib.sortBy("name_asc");

      expect(lib.sortOption.value).toBe("name_asc");
      expect(list).toHaveBeenCalledWith({});
      expect(list.mock.calls[0][0]).not.toHaveProperty("sort");
    });
  });

  describe("navigateToFolder", () => {
    it("resets state and loads items", async () => {
      const list = vi.fn(async () => ({ items: [] }));
      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      lib.searchQuery.value = "test";
      lib.selectedItems.value = new Set(["m1"]);
      lib.previewItem.value = createAsset("m1");

      await lib.navigateToFolder("f1");

      expect(lib.viewMode.value).toBe("files");
      expect(lib.currentFolderId.value).toBe("f1");
      expect(lib.searchQuery.value).toBe("");
      expect(lib.selectedItems.value.size).toBe(0);
      expect(lib.previewItem.value).toBeNull();
      expect(list).toHaveBeenCalledWith({ folderId: "f1" });
    });

    it("navigates to root with null", async () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      lib.currentFolderId.value = "f1";
      await lib.navigateToFolder(null);

      expect(lib.currentFolderId.value).toBeNull();
    });

    it("stale loadItems response does not overwrite newer folder content", async () => {
      const folderAItems = [createAsset("A1"), createAsset("A2")];
      const folderBItems = [createAsset("B1")];

      let resolveA!: (value: MediaListPage) => void;
      let resolveB!: (value: MediaListPage) => void;
      const list = vi
        .fn<MediaProvider["list"]>()
        .mockImplementationOnce(() => new Promise((r) => (resolveA = r)))
        .mockImplementationOnce(() => new Promise((r) => (resolveB = r)));

      const lib = useMediaLibrary({ provider: fakeProvider({ list }) });

      const navA = lib.navigateToFolder("A");
      const navB = lib.navigateToFolder("B");

      resolveB({ items: folderBItems });
      await navB;
      resolveA({ items: folderAItems });
      await navA;

      expect(lib.currentFolderId.value).toBe("B");
      expect(lib.items.value.map((item) => item.id)).toEqual(["B1"]);
    });
  });

  describe("showFrequentlyUsed", () => {
    it("switches view mode and loads frequently used", async () => {
      const frequentlyUsed = vi.fn(async () => [createAsset("m1")]);
      const lib = useMediaLibrary({
        provider: fakeProvider({ frequentlyUsed }),
      });

      await lib.showFrequentlyUsed();

      expect(lib.viewMode.value).toBe("frequently-used");
      expect(lib.currentFolderId.value).toBeNull();
      expect(lib.searchQuery.value).toBe("");
      expect(lib.frequentlyUsedItems.value.map((item) => item.id)).toEqual([
        "m1",
      ]);
      expect(frequentlyUsed).toHaveBeenCalledTimes(1);
    });
  });

  describe("upload", () => {
    it("uploads file and prepends to items", async () => {
      const uploaded = createAsset("new-1");
      const create = vi.fn(async () => uploaded);
      const lib = useMediaLibrary({ provider: fakeProvider({ create }) });

      lib.items.value = [createAsset("m1")];

      const result = await lib.uploadFile(new File(["data"], "photo.jpg"));

      expect(result).toEqual(uploaded);
      expect(lib.items.value[0]).toEqual(uploaded);
      expect(lib.items.value).toHaveLength(2);
      expect(create).toHaveBeenCalledWith({
        file: expect.any(File),
      });
    });

    it("passes current folderId on create", async () => {
      const create = vi.fn(async () => createAsset("new-1"));
      const lib = useMediaLibrary({ provider: fakeProvider({ create }) });
      lib.currentFolderId.value = "f1";

      await lib.uploadFile(new File(["data"], "photo.jpg"));

      expect(create).toHaveBeenCalledWith({
        file: expect.any(File),
        folderId: "f1",
      });
    });

    it("returns null on upload failure and does not prepend", async () => {
      const create = vi.fn(async () => {
        throw new Error("fail");
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ create }),
        onError,
      });
      lib.items.value = [createAsset("m1")];

      const result = await lib.uploadFile(new File(["data"], "photo.jpg"));

      expect(result).toBeNull();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(lib.items.value.map((item) => item.id)).toEqual(["m1"]);
    });

    it("tracks progress during multi-file upload", async () => {
      const create = vi.fn(async ({ file }) =>
        createAsset(file.name, { url: `https://cdn.example/${file.name}` }),
      );
      const lib = useMediaLibrary({ provider: fakeProvider({ create }) });

      const files = [new File(["a"], "a.jpg"), new File(["b"], "b.jpg")];
      await lib.uploadFiles(files);

      expect(lib.uploadProgress.value).toBeNull();
      expect(lib.isUploading.value).toBe(false);
      expect(lib.items.value.map((item) => item.id)).toEqual([
        "b.jpg",
        "a.jpg",
      ]);
    });
  });

  describe("upload edge cases", () => {
    it("handles partial failure in multi-file upload", async () => {
      const create = vi
        .fn<Exclude<MediaProvider["create"], false>>()
        .mockResolvedValueOnce(createAsset("m1"))
        .mockRejectedValueOnce(new Error("Upload failed"))
        .mockResolvedValueOnce(createAsset("m3"));

      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ create }),
        onError,
      });

      const files = [
        new File(["a"], "a.jpg"),
        new File(["b"], "b.jpg"),
        new File(["c"], "c.jpg"),
      ];
      await lib.uploadFiles(files);

      expect(lib.items.value.map((item) => item.id)).toEqual(["m3", "m1"]);
      expect(onError).toHaveBeenCalledOnce();
      expect(lib.isUploading.value).toBe(false);
      expect(lib.uploadProgress.value).toBeNull();
    });

    it("uploadFiles is a no-op when create is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ create: false }),
      });
      lib.items.value = [createAsset("m1")];

      await lib.uploadFiles([new File(["a"], "a.jpg")]);

      expect(lib.items.value.map((item) => item.id)).toEqual(["m1"]);
      expect(lib.isUploading.value).toBe(false);
      expect(lib.uploadProgress.value).toBeNull();
    });
  });

  describe("selection", () => {
    it("toggleSelection adds and removes", () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      lib.toggleSelection("m1");
      expect(lib.selectedItems.value.has("m1")).toBe(true);

      lib.toggleSelection("m1");
      expect(lib.selectedItems.value.has("m1")).toBe(false);
    });

    it("clearSelection resets selection and preview", () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      lib.selectedItems.value = new Set(["m1", "m2"]);
      lib.previewItem.value = createAsset("m1");

      lib.clearSelection();

      expect(lib.selectedItems.value.size).toBe(0);
      expect(lib.previewItem.value).toBeNull();
    });

    it("selectItem sets preview and single selection", () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      const item = createAsset("m1");
      lib.selectItem(item);

      expect(lib.previewItem.value).toEqual(item);
      expect(lib.selectedItems.value.size).toBe(1);
      expect(lib.selectedItems.value.has("m1")).toBe(true);
    });
  });

  describe("deleteSelected", () => {
    it("removes selected items from all lists", async () => {
      const del = vi.fn(async () => {});
      const lib = useMediaLibrary({
        provider: fakeProvider({ delete: del }),
      });

      lib.items.value = [
        createAsset("m1"),
        createAsset("m2"),
        createAsset("m3"),
      ];
      lib.frequentlyUsedItems.value = [createAsset("m1")];
      lib.selectedItems.value = new Set(["m1", "m2"]);

      await lib.deleteSelected();

      expect(del).toHaveBeenCalledWith(["m1", "m2"]);
      expect(lib.items.value.map((item) => item.id)).toEqual(["m3"]);
      expect(lib.frequentlyUsedItems.value).toHaveLength(0);
      expect(lib.selectedItems.value.size).toBe(0);
    });

    it("does nothing when no selection", async () => {
      const del = vi.fn(async () => {});
      const lib = useMediaLibrary({
        provider: fakeProvider({ delete: del }),
      });

      await lib.deleteSelected();

      expect(del).not.toHaveBeenCalled();
    });

    it("does not call the store when delete is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ delete: false }),
      });
      lib.items.value = [createAsset("m1")];
      lib.selectedItems.value = new Set(["m1"]);

      await lib.deleteSelected();

      expect(lib.items.value.map((item) => item.id)).toEqual(["m1"]);
    });
  });

  describe("delete workflow (check usage -> confirm/cancel)", () => {
    it("checkUsageBeforeDelete returns true when items are in use", async () => {
      const checkUsage = vi.fn(async () => ({
        m1: { templateCount: 2, templateNames: ["T1", "T2"] },
      }));
      const lib = useMediaLibrary({
        provider: fakeProvider({ checkUsage }),
      });

      lib.selectedItems.value = new Set(["m1"]);

      const hasUsage = await lib.checkUsageBeforeDelete();

      expect(hasUsage).toBe(true);
      expect(lib.showDeleteWarning.value).toBe(true);
      expect(lib.deleteUsageInfo.value.m1.templateCount).toBe(2);
      expect(checkUsage).toHaveBeenCalledWith(["m1"]);
    });

    it("checkUsageBeforeDelete returns false when no items selected", async () => {
      const checkUsage = vi.fn(async () => ({}));
      const lib = useMediaLibrary({
        provider: fakeProvider({ checkUsage }),
      });

      const hasUsage = await lib.checkUsageBeforeDelete();
      expect(hasUsage).toBe(false);
      expect(checkUsage).not.toHaveBeenCalled();
    });

    it("skips the store when checkUsage is false and still opens the warning", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ checkUsage: false }),
      });
      lib.selectedItems.value = new Set(["m1"]);

      const hasUsage = await lib.checkUsageBeforeDelete();

      expect(hasUsage).toBe(false);
      expect(lib.showDeleteWarning.value).toBe(true);
      expect(lib.deleteUsageInfo.value).toEqual({});
    });

    it("confirmDelete deletes and cleans up state", async () => {
      const checkUsage = vi.fn(async () => ({
        m1: { templateCount: 0, templateNames: [] },
      }));
      const del = vi.fn(async () => {});
      const lib = useMediaLibrary({
        provider: fakeProvider({ checkUsage, delete: del }),
      });

      lib.items.value = [createAsset("m1"), createAsset("m2")];
      lib.selectedItems.value = new Set(["m1"]);

      await lib.checkUsageBeforeDelete();
      await lib.confirmDelete();

      expect(del).toHaveBeenCalledWith(["m1"]);
      expect(lib.items.value.map((item) => item.id)).toEqual(["m2"]);
      expect(lib.showDeleteWarning.value).toBe(false);
      expect(lib.selectedItems.value.size).toBe(0);
    });

    it("cancelDelete resets warning state", () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      lib.showDeleteWarning.value = true;
      lib.deleteUsageInfo.value = {
        m1: { templateCount: 1, templateNames: ["T1"] },
      };

      lib.cancelDelete();

      expect(lib.showDeleteWarning.value).toBe(false);
      expect(lib.deleteUsageInfo.value).toEqual({});
    });
  });

  describe("moveSelected", () => {
    it("removes items from current folder view", async () => {
      const move = vi.fn(async () => [createAsset("m1", { folderId: "f2" })]);
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders: fakeFolders({ move }) }),
      });

      lib.currentFolderId.value = "f1";
      lib.items.value = [createAsset("m1"), createAsset("m2")];
      lib.selectedItems.value = new Set(["m1"]);

      await lib.moveSelected("f2");

      expect(move).toHaveBeenCalledWith(["m1"], "f2");
      expect(lib.items.value.map((item) => item.id)).toEqual(["m2"]);
      expect(lib.selectedItems.value.size).toBe(0);
    });

    it("does nothing when no selection", async () => {
      const move = vi.fn(async () => []);
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders: fakeFolders({ move }) }),
      });

      await lib.moveSelected("f1");

      expect(move).not.toHaveBeenCalled();
    });

    it("updates items in-place when in root folder", async () => {
      const move = vi.fn(async () => [createAsset("m1", { folderId: "f2" })]);
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders: fakeFolders({ move }) }),
      });

      lib.currentFolderId.value = null;
      lib.items.value = [createAsset("m1"), createAsset("m2")];
      lib.selectedItems.value = new Set(["m1"]);

      await lib.moveSelected("f2");

      expect(lib.items.value).toHaveLength(2);
      expect(lib.items.value[0].folderId).toBe("f2");
    });

    it("does not call move when folders is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders: false }),
      });
      lib.items.value = [createAsset("m1")];
      lib.selectedItems.value = new Set(["m1"]);

      await lib.moveSelected("f2");

      expect(lib.items.value.map((item) => item.id)).toEqual(["m1"]);
    });
  });

  describe("updateFile", () => {
    it("updates item in list and preview", async () => {
      const update = vi.fn(async () =>
        createAsset("m1", { filename: "renamed.jpg", alt: "Alt" }),
      );
      const lib = useMediaLibrary({ provider: fakeProvider({ update }) });

      lib.items.value = [createAsset("m1"), createAsset("m2")];
      lib.previewItem.value = createAsset("m1");

      await lib.updateFile("m1", "renamed.jpg", "Alt");

      expect(update).toHaveBeenCalledWith("m1", {
        filename: "renamed.jpg",
        alt: "Alt",
      });
      expect(lib.items.value[0].filename).toBe("renamed.jpg");
      expect(lib.previewItem.value!.filename).toBe("renamed.jpg");
      expect(lib.previewItem.value!.alt).toBe("Alt");
    });

    it("does not call the store when update is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ update: false }),
      });
      lib.items.value = [createAsset("m1", { filename: "keep.jpg" })];

      await lib.updateFile("m1", "renamed.jpg", "Alt");

      expect(lib.items.value[0].filename).toBe("keep.jpg");
    });
  });

  describe("importFromUrl", () => {
    it("imports and prepends to items", async () => {
      const imported = createAsset("imported-1");
      const importFromUrl = vi.fn(async () => imported);
      const lib = useMediaLibrary({
        provider: fakeProvider({ importFromUrl }),
      });

      const result = await lib.importFromUrl("https://example.com/img.jpg");

      expect(result).toEqual(imported);
      expect(lib.items.value[0]).toEqual(imported);
      expect(lib.isImportingFromUrl.value).toBe(false);
      expect(importFromUrl).toHaveBeenCalledWith(
        "https://example.com/img.jpg",
        null,
      );
    });

    it("sets error on failure", async () => {
      const importFromUrl = vi.fn(async () => {
        throw new Error("Invalid URL");
      });
      const lib = useMediaLibrary({
        provider: fakeProvider({ importFromUrl }),
      });

      const result = await lib.importFromUrl("bad-url");

      expect(result).toBeNull();
      expect(lib.importFromUrlError.value).toBe("Invalid URL");
      expect(lib.items.value).toEqual([]);
    });

    it("returns null when importFromUrl is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ importFromUrl: false }),
      });

      const result = await lib.importFromUrl("https://example.com/img.jpg");

      expect(result).toBeNull();
      expect(lib.items.value).toEqual([]);
    });
  });

  describe("folders", () => {
    it("loads folders from the provider", async () => {
      const stored = [createFolder("f1", "Photos")];
      const folders = fakeFolders({
        list: vi.fn(async () => stored),
      });
      const lib = useMediaLibrary({ provider: fakeProvider({ folders }) });

      await lib.loadFolders();

      expect(lib.folders.value).toEqual(stored);
    });

    it("loadFolders is a no-op when folders is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders: false }),
      });
      lib.folders.value = [createFolder("f1", "Keep")];

      await lib.loadFolders();

      expect(lib.folders.value).toEqual([createFolder("f1", "Keep")]);
    });

    it("creates folder and reloads the list", async () => {
      const folder = createFolder("f2", "New Folder");
      const folders = fakeFolders({
        create: vi.fn(async () => folder),
      });
      const lib = useMediaLibrary({ provider: fakeProvider({ folders }) });

      const result = await lib.createFolder("New Folder");

      expect(result).toEqual(folder);
      expect(folders.create).toHaveBeenCalledWith({ name: "New Folder" });
      expect(folders.list).toHaveBeenCalled();
    });

    it("findFolderInTree finds a folder in a flat list", () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      const list = [
        createFolder("f1", "Root"),
        createFolder("f2", "Child", "f1"),
        createFolder("f3", "Grandchild", "f2"),
      ];

      expect(lib.findFolderInTree(list, "f3")?.name).toBe("Grandchild");
      expect(lib.findFolderInTree(list, "f1")?.name).toBe("Root");
      expect(lib.findFolderInTree(list, "nonexistent")).toBeNull();
    });

    it("findFolderInTree returns null for empty list", () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      expect(lib.findFolderInTree([], "any-id")).toBeNull();
    });

    it("createFolder calls onError and returns null on failure", async () => {
      const error = new Error("Create folder failed");
      const folders = fakeFolders({
        create: vi.fn(async () => {
          throw error;
        }),
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders }),
        onError,
      });

      lib.folders.value = [createFolder("f1", "Existing")];

      const result = await lib.createFolder("New Folder", "parent-1");

      expect(result).toBeNull();
      expect(onError).toHaveBeenCalledWith(error);
      expect(folders.list).not.toHaveBeenCalled();
      expect(lib.folders.value).toEqual([createFolder("f1", "Existing")]);
    });

    it("createFolder returns null when folders is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders: false }),
      });

      const result = await lib.createFolder("New Folder");

      expect(result).toBeNull();
      expect(lib.folders.value).toEqual([]);
    });

    it("deleteFolder calls onError and leaves state consistent on failure", async () => {
      const error = new Error("Delete folder failed");
      const folders = fakeFolders({
        delete: vi.fn(async () => {
          throw error;
        }),
      });
      const list = vi.fn(async () => ({ items: [] }));
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders, list }),
        onError,
      });

      lib.folders.value = [
        createFolder("f1", "Parent"),
        createFolder("f2", "Child", "f1"),
      ];
      lib.currentFolderId.value = "f2";

      await lib.deleteFolder("f2");

      expect(onError).toHaveBeenCalledWith(error);
      expect(lib.currentFolderId.value).toBe("f2");
      expect(folders.list).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
      expect(lib.folders.value.map((folder) => folder.id)).toEqual([
        "f1",
        "f2",
      ]);
    });

    it("deleteFolder stays in current folder if different from deleted", async () => {
      const folders = fakeFolders();
      const lib = useMediaLibrary({ provider: fakeProvider({ folders }) });

      lib.folders.value = [
        createFolder("f1", "Folder1"),
        createFolder("f2", "Folder2"),
      ];
      lib.currentFolderId.value = "f1";

      await lib.deleteFolder("f2");

      expect(lib.currentFolderId.value).toBe("f1");
      expect(folders.delete).toHaveBeenCalledWith("f2");
    });

    it("deleteFolder navigates to parent if current folder is deleted", async () => {
      const folders = fakeFolders();
      const lib = useMediaLibrary({ provider: fakeProvider({ folders }) });

      lib.folders.value = [
        createFolder("f1", "Parent"),
        createFolder("f2", "Child", "f1"),
      ];
      lib.currentFolderId.value = "f2";

      await lib.deleteFolder("f2");

      expect(lib.currentFolderId.value).toBe("f1");
    });
  });

  describe("renameFolder", () => {
    it("renames folder and reloads the list", async () => {
      const folders = fakeFolders({
        update: vi.fn(async () => createFolder("f1", "Renamed")),
      });
      const lib = useMediaLibrary({ provider: fakeProvider({ folders }) });

      await lib.renameFolder("f1", "Renamed");

      expect(folders.update).toHaveBeenCalledWith("f1", { name: "Renamed" });
      expect(folders.list).toHaveBeenCalled();
    });

    it("calls onError on failure", async () => {
      const folders = fakeFolders({
        update: vi.fn(async () => {
          throw new Error("Rename failed");
        }),
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ folders }),
        onError,
      });

      await lib.renameFolder("f1", "Bad Name");

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("loadFrequentlyUsed", () => {
    it("loads frequently used items", async () => {
      const stored = [createAsset("m1"), createAsset("m2")];
      const frequentlyUsed = vi.fn(async () => stored);
      const lib = useMediaLibrary({
        provider: fakeProvider({ frequentlyUsed }),
      });

      await lib.loadFrequentlyUsed();

      expect(lib.frequentlyUsedItems.value).toEqual(stored);
    });

    it("calls onError on failure", async () => {
      const frequentlyUsed = vi.fn(async () => {
        throw new Error("Failed");
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ frequentlyUsed }),
        onError,
      });

      await lib.loadFrequentlyUsed();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(lib.frequentlyUsedItems.value).toEqual([]);
    });

    it("is a no-op when frequentlyUsed is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ frequentlyUsed: false }),
      });
      lib.frequentlyUsedItems.value = [createAsset("keep")];

      await lib.loadFrequentlyUsed();

      expect(lib.frequentlyUsedItems.value.map((item) => item.id)).toEqual([
        "keep",
      ]);
    });
  });

  describe("replace workflow", () => {
    it("checkUsageBeforeReplace sets warning state", async () => {
      const checkUsage = vi.fn(async () => ({
        m1: { templateCount: 3, templateNames: ["T1", "T2", "T3"] },
      }));
      const lib = useMediaLibrary({
        provider: fakeProvider({ checkUsage }),
      });

      const item = createAsset("m1");
      await lib.checkUsageBeforeReplace(item);

      expect(lib.pendingReplaceItem.value).toEqual(item);
      expect(lib.showReplaceWarning.value).toBe(true);
      expect(lib.replaceUsageInfo.value?.templateCount).toBe(3);
    });

    it("checkUsageBeforeReplace calls onError and leaves warning closed on failure", async () => {
      const error = new Error("Usage check failed");
      const checkUsage = vi.fn(async () => {
        throw error;
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ checkUsage }),
        onError,
      });

      const item = createAsset("m1");
      await lib.checkUsageBeforeReplace(item);

      expect(onError).toHaveBeenCalledWith(error);
      expect(lib.showReplaceWarning.value).toBe(false);
      expect(lib.replaceUsageInfo.value).toBeNull();
      expect(lib.pendingReplaceItem.value).toEqual(item);
      expect(lib.replaceError.value).toBeNull();
    });

    it("cancelReplace clears all replace state", () => {
      const lib = useMediaLibrary({ provider: fakeProvider() });

      lib.showReplaceWarning.value = true;
      lib.pendingReplaceItem.value = createAsset("m1");
      lib.replaceUsageInfo.value = {
        templateCount: 1,
        templateNames: ["T"],
      };
      lib.replaceError.value = "some error";

      lib.cancelReplace();

      expect(lib.showReplaceWarning.value).toBe(false);
      expect(lib.pendingReplaceItem.value).toBeNull();
      expect(lib.replaceUsageInfo.value).toBeNull();
      expect(lib.replaceError.value).toBeNull();
    });

    it("replaceFile updates item in all lists", async () => {
      const updated = createAsset("m1", { filename: "replaced.jpg" });
      const replace = vi.fn(async () => updated);
      const lib = useMediaLibrary({ provider: fakeProvider({ replace }) });

      lib.items.value = [createAsset("m1")];
      lib.frequentlyUsedItems.value = [createAsset("m1")];
      lib.previewItem.value = createAsset("m1");
      lib.pendingReplaceItem.value = createAsset("m1");

      const result = await lib.replaceFile(new File(["new"], "replaced.jpg"));

      expect(result).toEqual(updated);
      expect(lib.items.value[0].filename).toBe("replaced.jpg");
      expect(lib.frequentlyUsedItems.value[0].filename).toBe("replaced.jpg");
      expect(lib.previewItem.value!.filename).toBe("replaced.jpg");
      expect(lib.showReplaceWarning.value).toBe(false);
      expect(lib.pendingReplaceItem.value).toBeNull();
    });

    it("replaceFile sets replaceError on failure", async () => {
      const replace = vi.fn(async () => {
        throw new Error("Replace failed");
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ replace }),
        onError,
      });

      lib.pendingReplaceItem.value = createAsset("m1");

      const result = await lib.replaceFile(new File(["data"], "new.jpg"));

      expect(result).toBeNull();
      expect(lib.replaceError.value).toBe("Replace failed");
      expect(lib.isReplacing.value).toBe(false);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("replaceFile returns null when no pending item", async () => {
      const replace = vi.fn(async () => createAsset("m1"));
      const lib = useMediaLibrary({ provider: fakeProvider({ replace }) });

      const result = await lib.replaceFile(new File(["data"], "file.jpg"));
      expect(result).toBeNull();
      expect(replace).not.toHaveBeenCalled();
    });

    it("replaceFile returns null when replace is false", async () => {
      const lib = useMediaLibrary({
        provider: fakeProvider({ replace: false }),
      });
      lib.pendingReplaceItem.value = createAsset("m1");

      const result = await lib.replaceFile(new File(["data"], "file.jpg"));
      expect(result).toBeNull();
    });

    it("replaceMediaDirectly updates without workflow", async () => {
      const updated = createAsset("m1", { filename: "direct.jpg" });
      const replace = vi.fn(async () => updated);
      const lib = useMediaLibrary({ provider: fakeProvider({ replace }) });

      lib.items.value = [createAsset("m1")];

      const result = await lib.replaceMediaDirectly(
        "m1",
        new File(["data"], "direct.jpg"),
      );

      expect(result).toEqual(updated);
      expect(replace).toHaveBeenCalledWith("m1", expect.any(File));
      expect(lib.items.value[0].filename).toBe("direct.jpg");
    });

    it("replaceMediaDirectly updates frequently used items", async () => {
      const updated = createAsset("m1", { filename: "updated.jpg" });
      const replace = vi.fn(async () => updated);
      const lib = useMediaLibrary({ provider: fakeProvider({ replace }) });

      lib.items.value = [createAsset("m1")];
      lib.frequentlyUsedItems.value = [createAsset("m1")];
      lib.previewItem.value = createAsset("m1");

      await lib.replaceMediaDirectly("m1", new File(["data"], "updated.jpg"));

      expect(lib.frequentlyUsedItems.value[0].filename).toBe("updated.jpg");
      expect(lib.previewItem.value?.filename).toBe("updated.jpg");
    });

    it("replaceMediaDirectly calls onError on failure", async () => {
      const replace = vi.fn(async () => {
        throw new Error("Direct replace failed");
      });
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({ replace }),
        onError,
      });

      const result = await lib.replaceMediaDirectly(
        "m1",
        new File(["data"], "file.jpg"),
      );

      expect(result).toBeNull();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("replaceMediaDirectly does not update preview when different id", async () => {
      const updated = createAsset("m2", { filename: "other.jpg" });
      const replace = vi.fn(async () => updated);
      const lib = useMediaLibrary({ provider: fakeProvider({ replace }) });

      lib.previewItem.value = createAsset("m1");

      await lib.replaceMediaDirectly("m2", new File(["data"], "other.jpg"));

      expect(lib.previewItem.value?.id).toBe("m1");
    });
  });

  describe("events", () => {
    it("fires onCreated after a successful upload", async () => {
      const uploaded = createAsset("new-1");
      const onCreated = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({
          create: vi.fn(async () => uploaded),
          onCreated,
        }),
      });

      await lib.uploadFile(new File(["x"], "x.jpg"));

      expect(onCreated).toHaveBeenCalledWith(uploaded);
    });

    it("does not fire onCreated when create rejects", async () => {
      const onCreated = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({
          create: vi.fn(async () => {
            throw new Error("fail");
          }),
          onCreated,
        }),
        onError: vi.fn(),
      });

      await lib.uploadFile(new File(["x"], "x.jpg"));

      expect(onCreated).not.toHaveBeenCalled();
      expect(lib.items.value).toEqual([]);
    });

    it("fires onDeleted with the captured asset", async () => {
      const onDeleted = vi.fn();
      const asset = createAsset("m1");
      const lib = useMediaLibrary({
        provider: fakeProvider({
          delete: vi.fn(async () => {}),
          onDeleted,
        }),
      });
      lib.items.value = [asset];
      lib.selectedItems.value = new Set(["m1"]);

      await lib.deleteSelected();

      expect(onDeleted).toHaveBeenCalledWith(asset);
    });

    it("does not fire onDeleted for an id that was never loaded", async () => {
      const onDeleted = vi.fn();
      const del = vi.fn(async () => {});
      const lib = useMediaLibrary({
        provider: fakeProvider({ delete: del, onDeleted }),
      });
      lib.selectedItems.value = new Set(["missing"]);

      await lib.deleteSelected();

      expect(del).toHaveBeenCalledWith(["missing"]);
      expect(onDeleted).not.toHaveBeenCalled();
    });

    it("a throwing onCreated does not fail the upload", async () => {
      const uploaded = createAsset("new-1");
      const onError = vi.fn();
      const lib = useMediaLibrary({
        provider: fakeProvider({
          create: vi.fn(async () => uploaded),
          onCreated: () => {
            throw new Error("handler");
          },
        }),
        onError,
      });

      const result = await lib.uploadFile(new File(["x"], "x.jpg"));

      expect(result).toEqual(uploaded);
      expect(lib.items.value[0]).toEqual(uploaded);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
