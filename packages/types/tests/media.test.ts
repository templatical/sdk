import { describe, expect, it } from "vitest";
import type {
  MediaAsset,
  MediaFoldersProvider,
  MediaListPage,
  MediaProvider,
} from "../src/media";
import * as media from "../src/media";

/**
 * The #700 CMS-gallery shape: `list` plus `create`, everything else `false`.
 * Pass overrides to turn it read-only (`create: false`) or to wire folders /
 * bulk delete.
 */
function cmsGallery(overrides: Partial<MediaProvider> = {}): MediaProvider {
  return {
    list: async () => ({ items: [] }),
    create: async ({ file }) => ({
      id: "uploaded",
      url: `https://cms.example/${encodeURIComponent(file.name)}`,
    }),
    update: false,
    delete: false,
    folders: false,
    replace: false,
    importFromUrl: false,
    checkUsage: false,
    frequentlyUsed: false,
    storage: false,
    ...overrides,
  };
}

describe("MediaProvider", () => {
  it("is a types-only module", () => {
    expect(Object.keys(media)).toEqual([]);
  });

  it("a read-only gallery satisfies the contract and lists an empty page", async () => {
    const provider = cmsGallery({ create: false });

    expect(typeof provider.list).toBe("function");
    expect(provider.create).toBe(false);
    expect(provider.update).toBe(false);
    expect(provider.delete).toBe(false);
    expect(provider.folders).toBe(false);
    expect(provider.replace).toBe(false);
    expect(provider.importFromUrl).toBe(false);
    expect(provider.checkUsage).toBe(false);
    expect(provider.frequentlyUsed).toBe(false);
    expect(provider.storage).toBe(false);

    expect(await provider.list()).toEqual({ items: [] });
  });

  it("the #700 CMS gallery keeps create and lists a page with a cursor", async () => {
    const asset: MediaAsset = {
      id: "img-1",
      url: "https://cms.example/hero.png",
      alt: "Hero",
    };
    const provider = cmsGallery({
      list: async () => ({ items: [asset], nextCursor: "cursor-2" }),
    });

    expect(typeof provider.list).toBe("function");
    expect(typeof provider.create).toBe("function");
    expect(provider.update).toBe(false);
    expect(provider.delete).toBe(false);
    expect(provider.folders).toBe(false);

    const page: MediaListPage = await provider.list({
      search: "hero",
      cursor: "cursor-1",
      templateId: "tpl-1",
    });
    expect(page).toEqual({ items: [asset], nextCursor: "cursor-2" });
  });

  it("delete is called with an array of ids", async () => {
    let received: string[] | undefined;
    const deleteAssets: Exclude<MediaProvider["delete"], false> = async (
      ids,
    ) => {
      received = ids;
    };
    const provider = cmsGallery({ create: false, delete: deleteAssets });

    expect(provider.delete).toBe(deleteAssets);
    await deleteAssets(["id-1", "id-2"]);
    expect(received).toEqual(["id-1", "id-2"]);
  });

  it("accepts a folders provider whose list is a flat array", async () => {
    const folders: MediaFoldersProvider = {
      list: async () => [{ id: "f1", name: "Hero", parentId: null }],
      create: false,
      update: false,
      delete: false,
      move: false,
    };
    const provider = cmsGallery({ create: false, folders });

    expect(provider.folders).toBe(folders);
    expect(await folders.list()).toEqual([
      { id: "f1", name: "Hero", parentId: null },
    ]);
  });
});
