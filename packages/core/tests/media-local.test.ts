import { describe, expect, it, vi } from "vitest";
import type {
  MediaAsset,
  MediaCreateInput,
  MediaProvider,
} from "@templatical/types";
import { createLocalStorageMediaProvider } from "../src/media-local";

const DEFAULT_KEY = "templatical:media";
const DATA_URL = "data:image/png;base64,abc";

/** Minimal in-memory Storage stub. `vi.unstubAllGlobals` in setup.ts cleans up. */
function stubLocalStorage(
  initial: Record<string, string> = {},
): Map<string, string> {
  const store = new Map<string, string>(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

function stubFileReader(dataUrl = DATA_URL): void {
  vi.stubGlobal(
    "FileReader",
    class {
      result: string | null = null;
      onload: ((this: this, ev: unknown) => void) | null = null;
      onerror: ((this: this, ev: unknown) => void) | null = null;
      error: Error | null = null;
      readAsDataURL(_blob: Blob) {
        this.result = dataUrl;
        this.onload?.(null);
      }
    },
  );
}

function makeFile(
  name = "hero.png",
  type = "image/png",
  contents = "hello",
): File {
  return new File([contents], name, { type });
}

function mutation<T>(value: false | T, name: string): T {
  if (value === false) {
    throw new Error(`${name} is disabled`);
  }
  return value;
}

async function createAsset(
  provider: MediaProvider,
  input: MediaCreateInput = { file: makeFile() },
): Promise<MediaAsset> {
  return mutation(provider.create, "create")(input);
}

describe("createLocalStorageMediaProvider", () => {
  describe("list", () => {
    it("returns an empty page when nothing is stored", async () => {
      stubLocalStorage();
      const provider = createLocalStorageMediaProvider();

      expect(await provider.list()).toEqual({ items: [] });
    });

    it("returns a created asset with that url", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      const created = await createAsset(provider);

      const page = await provider.list();

      expect(page.items).toEqual([created]);
      expect(page.items[0].url).toBe(DATA_URL);
      expect(page.nextCursor).toBeUndefined();
    });

    it("filters by filename, case-insensitively", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      await createAsset(provider, { file: makeFile("Hero.png") });
      await createAsset(provider, { file: makeFile("footer.png") });

      const hits = await provider.list({ search: "HERO" });

      expect(hits.items).toHaveLength(1);
      expect(hits.items[0].filename).toBe("Hero.png");
    });

    it("filters by alt, case-insensitively", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      await createAsset(provider, {
        file: makeFile("a.png"),
        alt: "Product shot",
      });
      await createAsset(provider, {
        file: makeFile("b.png"),
        alt: "Team photo",
      });

      const hits = await provider.list({ search: "PRODUCT" });

      expect(hits.items).toHaveLength(1);
      expect(hits.items[0].alt).toBe("Product shot");
    });

    it("treats a blank search as no filter", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      await createAsset(provider, { file: makeFile("a.png") });
      await createAsset(provider, { file: makeFile("b.png") });

      expect(await provider.list({ search: "   " })).toEqual(
        await provider.list(),
      );
    });

    it("returns an empty page when the search matches nothing", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      await createAsset(provider);

      expect(await provider.list({ search: "nope" })).toEqual({ items: [] });
    });

    it("pages in chunks of 50 and yields a cursor for the rest", async () => {
      const items: MediaAsset[] = Array.from({ length: 51 }, (_, i) => ({
        id: `id-${i}`,
        url: `https://example.com/${i}.png`,
        filename: `file-${i}.png`,
      }));
      stubLocalStorage({ [DEFAULT_KEY]: JSON.stringify(items) });
      const provider = createLocalStorageMediaProvider();

      const page1 = await provider.list();

      expect(page1.items).toHaveLength(50);
      expect(page1.items[0].id).toBe("id-0");
      expect(page1.items[49].id).toBe("id-49");
      expect(page1.nextCursor).toBe("50");

      const page2 = await provider.list({ cursor: page1.nextCursor });

      expect(page2.items).toEqual([items[50]]);
      expect(page2.nextCursor).toBeUndefined();
    });

    it("applies search before paging", async () => {
      const items: MediaAsset[] = Array.from({ length: 60 }, (_, i) => ({
        id: `id-${i}`,
        url: `https://example.com/${i}.png`,
        filename: i < 3 ? `hero-${i}.png` : `other-${i}.png`,
      }));
      stubLocalStorage({ [DEFAULT_KEY]: JSON.stringify(items) });
      const provider = createLocalStorageMediaProvider();

      const page = await provider.list({ search: "hero" });

      expect(page.items.map((a) => a.filename)).toEqual([
        "hero-0.png",
        "hero-1.png",
        "hero-2.png",
      ]);
      expect(page.nextCursor).toBeUndefined();
    });

    it("recovers from malformed JSON instead of throwing", async () => {
      stubLocalStorage({ [DEFAULT_KEY]: "{not json" });
      const provider = createLocalStorageMediaProvider();

      expect(await provider.list()).toEqual({ items: [] });
    });

    it("recovers when the stored value is valid JSON but not an array", async () => {
      stubLocalStorage({ [DEFAULT_KEY]: '{"nope":true}' });
      const provider = createLocalStorageMediaProvider();

      expect(await provider.list()).toEqual({ items: [] });
    });
  });

  describe("create", () => {
    it("assigns an id and timestamps, and stores the FileReader data URL", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      const file = makeFile("hero.png", "image/png", "hello");

      const created = await createAsset(provider, { file });

      expect(created.url).toBe(DATA_URL);
      expect(created.filename).toBe("hero.png");
      expect(created.mimeType).toBe("image/png");
      expect(created.size).toBe(file.size);
      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(created.createdAt).toBe(created.updatedAt);
      expect(Number.isNaN(Date.parse(created.createdAt!))).toBe(false);
    });

    it("uses input.filename and input.alt when supplied", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();

      const created = await createAsset(provider, {
        file: makeFile("raw.png"),
        filename: "renamed.png",
        alt: "Hero",
      });

      expect(created.filename).toBe("renamed.png");
      expect(created.alt).toBe("Hero");
    });

    it("omits alt when none is supplied", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();

      const created = await createAsset(provider);

      expect("alt" in created).toBe(false);
    });

    it("stores newest-first", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      await createAsset(provider, { file: makeFile("first.png") });
      await createAsset(provider, { file: makeFile("second.png") });

      const page = await provider.list();

      expect(page.items.map((a) => a.filename)).toEqual([
        "second.png",
        "first.png",
      ]);
    });

    it("gives each created asset a distinct id", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      const a = await createAsset(provider, { file: makeFile("a.png") });
      const b = await createAsset(provider, { file: makeFile("b.png") });

      expect(a.id).not.toBe(b.id);
    });

    it("persists across provider instances sharing the same storage", async () => {
      stubLocalStorage();
      stubFileReader();
      await createAsset(createLocalStorageMediaProvider(), {
        file: makeFile("hero.png"),
      });

      const fresh = createLocalStorageMediaProvider();

      expect((await fresh.list()).items.map((a) => a.filename)).toEqual([
        "hero.png",
      ]);
    });

    it("writes under a custom key when configured", async () => {
      const store = stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider({ key: "custom:key" });
      await createAsset(provider);

      expect(store.has("custom:key")).toBe(true);
      expect(store.has(DEFAULT_KEY)).toBe(false);
    });

    it("isolates providers configured with different keys", async () => {
      stubLocalStorage();
      stubFileReader();
      const a = createLocalStorageMediaProvider({ key: "a" });
      const b = createLocalStorageMediaProvider({ key: "b" });
      await createAsset(a, { file: makeFile("only-in-a.png") });

      expect(await b.list()).toEqual({ items: [] });
      expect((await a.list()).items.map((x) => x.filename)).toEqual([
        "only-in-a.png",
      ]);
    });

    it("rejects when FileReader fails", async () => {
      stubLocalStorage();
      vi.stubGlobal(
        "FileReader",
        class {
          onload: ((this: this, ev: unknown) => void) | null = null;
          onerror: ((this: this, ev: unknown) => void) | null = null;
          error = new Error("read failed");
          readAsDataURL(_blob: Blob) {
            this.onerror?.(null);
          }
        },
      );
      const provider = createLocalStorageMediaProvider();

      await expect(createAsset(provider)).rejects.toThrow("read failed");
    });
  });

  describe("update", () => {
    it("patches alt and filename and bumps updatedAt without touching createdAt or url", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      const created = await createAsset(provider, {
        file: makeFile("old.png"),
        alt: "Old",
      });

      const patched = await mutation(
        provider.update,
        "update",
      )(created.id, { alt: "New", filename: "new.png" });

      expect(patched.id).toBe(created.id);
      expect(patched.url).toBe(created.url);
      expect(patched.alt).toBe("New");
      expect(patched.filename).toBe("new.png");
      expect(patched.createdAt).toBe(created.createdAt);
      expect(Date.parse(patched.updatedAt!)).toBeGreaterThanOrEqual(
        Date.parse(created.updatedAt!),
      );
    });

    it("persists the update", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      const created = await createAsset(provider, {
        file: makeFile(),
        alt: "Old",
      });
      await mutation(provider.update, "update")(created.id, { alt: "New" });

      expect((await provider.list()).items.map((a) => a.alt)).toEqual(["New"]);
    });

    it("preserves list position on update", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      await createAsset(provider, { file: makeFile("first.png") });
      const second = await createAsset(provider, {
        file: makeFile("second.png"),
      });
      await mutation(provider.update, "update")(second.id, {
        filename: "renamed.png",
      });

      expect((await provider.list()).items.map((a) => a.filename)).toEqual([
        "renamed.png",
        "first.png",
      ]);
    });

    it("rejects for an unknown id, mirroring a REST 404", async () => {
      stubLocalStorage();
      const provider = createLocalStorageMediaProvider();

      await expect(
        mutation(provider.update, "update")("nope", { alt: "x" }),
      ).rejects.toThrow("Media asset not found: nope");
    });
  });

  describe("delete", () => {
    it("removes the assets", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      const a = await createAsset(provider, { file: makeFile("a.png") });
      const b = await createAsset(provider, { file: makeFile("b.png") });
      await createAsset(provider, { file: makeFile("c.png") });

      await mutation(provider.delete, "delete")([a.id, b.id]);

      expect((await provider.list()).items.map((x) => x.filename)).toEqual([
        "c.png",
      ]);
    });

    it("rejects for an unknown id", async () => {
      stubLocalStorage();
      stubFileReader();
      const provider = createLocalStorageMediaProvider();
      const kept = await createAsset(provider, { file: makeFile("kept.png") });

      await expect(
        mutation(provider.delete, "delete")(["nope"]),
      ).rejects.toThrow("Media asset not found: nope");
      expect((await provider.list()).items.map((a) => a.id)).toEqual([kept.id]);
    });
  });

  describe("cloud extras", () => {
    it("disables folders and Cloud-only methods", () => {
      stubLocalStorage();
      const provider = createLocalStorageMediaProvider();

      expect(provider.folders).toBe(false);
      expect(provider.replace).toBe(false);
      expect(provider.importFromUrl).toBe(false);
      expect(provider.checkUsage).toBe(false);
      expect(provider.frequentlyUsed).toBe(false);
      expect(provider.storage).toBe(false);
    });
  });

  describe("without localStorage", () => {
    it("rejects an actionable error naming the provider", async () => {
      vi.stubGlobal("localStorage", undefined);
      const provider = createLocalStorageMediaProvider();

      await expect(provider.list()).rejects.toThrow(
        /createLocalStorageMediaProvider requires a browser environment/,
      );
    });
  });

  describe("quota", () => {
    it("rejects when setItem throws, rather than throwing synchronously", async () => {
      stubFileReader();
      vi.stubGlobal("localStorage", {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceeded");
        },
      });
      const provider = createLocalStorageMediaProvider();

      const pending = createAsset(provider);
      expect(pending).toBeInstanceOf(Promise);
      await expect(pending).rejects.toThrow("QuotaExceeded");
    });
  });
});
