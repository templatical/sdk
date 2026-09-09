import type {
  MediaAsset,
  MediaAssetPatch,
  MediaCreateInput,
  MediaListPage,
  MediaListParams,
  MediaProvider,
} from "@templatical/types";
import { generateId } from "@templatical/types";

export interface LocalStorageMediaProviderOptions {
  /**
   * `localStorage` key holding the serialized array.
   *
   * @default "templatical:media"
   */
  key?: string;
}

const DEFAULT_KEY = "templatical:media";
const PAGE_SIZE = 50;

/**
 * Browser-local {@link MediaProvider} backed by `localStorage`.
 *
 * Opt-in: pass it explicitly as `init({ media: createLocalStorageMediaProvider() })`.
 * The editor never falls back to it, so consumers without a provider keep
 * image fields URL-only.
 *
 * `create` stores the file as a data URL. That is a demo-sized persistence
 * model — `localStorage` quotas are typically ~5 MB, and a few large
 * images will fill it. Back a real gallery with your own API.
 *
 * Folders, replace, import, usage, frequently-used and quota are `false`:
 * this adapter is a flat list of assets.
 */
export function createLocalStorageMediaProvider(
  options: LocalStorageMediaProviderOptions = {},
): MediaProvider {
  const storageKey = options.key ?? DEFAULT_KEY;

  function getStorage(): Storage {
    // Core targets a neutral platform, so `localStorage` isn't guaranteed —
    // fail with an actionable message rather than a bare ReferenceError.
    if (typeof localStorage === "undefined") {
      throw new Error(
        "[Templatical] createLocalStorageMediaProvider requires a browser environment with localStorage. Supply your own MediaProvider for server-side or non-browser use.",
      );
    }
    return localStorage;
  }

  function readAll(): MediaAsset[] {
    const raw = getStorage().getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      // Tolerate a corrupted or hand-edited value rather than breaking the
      // editor: treat anything that isn't an array as "no assets".
      return Array.isArray(parsed) ? (parsed as MediaAsset[]) : [];
    } catch {
      return [];
    }
  }

  function writeAll(assets: MediaAsset[]): void {
    getStorage().setItem(storageKey, JSON.stringify(assets));
  }

  function readFileAsDataURL(file: File): Promise<string> {
    if (typeof FileReader === "undefined") {
      return Promise.reject(
        new Error(
          "[Templatical] createLocalStorageMediaProvider requires a browser environment with FileReader.",
        ),
      );
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("[Templatical] Failed to read file as a data URL."));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => {
        reject(
          reader.error ??
            new Error("[Templatical] Failed to read file as a data URL."),
        );
      };
      reader.readAsDataURL(file);
    });
  }

  // Every method is `async` so a synchronous failure (a missing
  // `localStorage`, a quota error from `setItem`) surfaces as a rejected
  // promise rather than a sync throw — callers of a `Promise`-returning
  // contract must be able to rely on `.catch()`.
  return {
    async list(params?: MediaListParams): Promise<MediaListPage> {
      const all = readAll();
      const search = params?.search?.trim().toLowerCase();
      const filtered = search
        ? all.filter((asset) => {
            const filename = asset.filename?.toLowerCase() ?? "";
            const alt = asset.alt?.toLowerCase() ?? "";
            return filename.includes(search) || alt.includes(search);
          })
        : all;
      const parsed = params?.cursor ? Number.parseInt(params.cursor, 10) : 0;
      const offset = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      const items = filtered.slice(offset, offset + PAGE_SIZE);
      const page: MediaListPage = { items };
      const nextOffset = offset + items.length;
      if (nextOffset < filtered.length) {
        page.nextCursor = String(nextOffset);
      }
      return page;
    },

    async create(input: MediaCreateInput): Promise<MediaAsset> {
      const url = await readFileAsDataURL(input.file);
      const now = new Date().toISOString();
      const created: MediaAsset = {
        id: generateId(),
        url,
        filename: input.filename || input.file.name,
        createdAt: now,
        updatedAt: now,
        size: input.file.size,
      };
      if (input.alt !== undefined) created.alt = input.alt;
      if (input.file.type) created.mimeType = input.file.type;
      if (input.folderId !== undefined) created.folderId = input.folderId;
      // Newest-first, matching the order the composable applies locally after
      // a create — so a reload preserves what the user just saw.
      writeAll([created, ...readAll()]);
      return created;
    },

    async update(id: string, patch: MediaAssetPatch): Promise<MediaAsset> {
      const all = readAll();
      const index = all.findIndex((asset) => asset.id === id);
      // Mirrors a REST 404 so provider behavior is consistent across adapters.
      if (index === -1) {
        throw new Error(`[Templatical] Media asset not found: ${id}`);
      }
      const current = all[index];
      const updated: MediaAsset = {
        ...current,
        ...patch,
        id: current.id,
        url: current.url,
        updatedAt: new Date().toISOString(),
      };
      const next = [...all];
      next[index] = updated;
      writeAll(next);
      return updated;
    },

    async delete(ids: string[]): Promise<void> {
      const all = readAll();
      for (const id of ids) {
        if (!all.some((asset) => asset.id === id)) {
          throw new Error(`[Templatical] Media asset not found: ${id}`);
        }
      }
      const remove = new Set(ids);
      writeAll(all.filter((asset) => !remove.has(asset.id)));
    },

    folders: false,
    replace: false,
    importFromUrl: false,
    checkUsage: false,
    frequentlyUsed: false,
    storage: false,
  };
}
