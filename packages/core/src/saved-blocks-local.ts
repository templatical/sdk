import type {
  Block,
  SavedBlock,
  SavedBlocksListParams,
  SavedBlocksProvider,
} from "@templatical/types";
import { generateId } from "@templatical/types";

export interface LocalStorageSavedBlocksOptions {
  /**
   * `localStorage` key holding the serialized array.
   *
   * @default "templatical:saved-blocks"
   */
  key?: string;
}

const DEFAULT_KEY = "templatical:saved-blocks";

/**
 * Browser-local {@link SavedBlocksProvider} backed by `localStorage`.
 *
 * Opt-in: pass it explicitly as `init({ savedBlocks: createLocalStorageSavedBlocksProvider() })`.
 * The editor never falls back to it, so consumers without a provider keep the
 * feature — and its UI — entirely off.
 *
 * Intended for demos, prototypes, and single-device use. Entries live in one
 * browser profile only: they don't sync across devices or users, and clearing
 * site data removes them. Back saved blocks with your own API for anything
 * that needs to outlive a browser profile.
 */
export function createLocalStorageSavedBlocksProvider(
  options: LocalStorageSavedBlocksOptions = {},
): SavedBlocksProvider {
  const storageKey = options.key ?? DEFAULT_KEY;

  function getStorage(): Storage {
    // Core targets a neutral platform, so `localStorage` isn't guaranteed —
    // fail with an actionable message rather than a bare ReferenceError.
    if (typeof localStorage === "undefined") {
      throw new Error(
        "[Templatical] createLocalStorageSavedBlocksProvider requires a browser environment with localStorage. Supply your own SavedBlocksProvider for server-side or non-browser use.",
      );
    }
    return localStorage;
  }

  function readAll(): SavedBlock[] {
    const raw = getStorage().getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      // Tolerate a corrupted or hand-edited value rather than breaking the
      // editor: treat anything that isn't an array as "no saved blocks".
      return Array.isArray(parsed) ? (parsed as SavedBlock[]) : [];
    } catch {
      return [];
    }
  }

  function writeAll(blocks: SavedBlock[]): void {
    getStorage().setItem(storageKey, JSON.stringify(blocks));
  }

  // Every method is `async` so a synchronous failure (a missing
  // `localStorage`, a quota error from `setItem`) surfaces as a rejected
  // promise rather than a sync throw — callers of a `Promise`-returning
  // contract must be able to rely on `.catch()`.
  return {
    // The editor calls this bare and filters in memory; the params are honored
    // for headless callers that would rather the provider did the work.
    async list(params?: SavedBlocksListParams): Promise<SavedBlock[]> {
      const all = readAll();
      const search = params?.search?.trim().toLowerCase();
      const category = params?.category?.trim();
      return all.filter((b) => {
        if (search && !b.name.toLowerCase().includes(search)) return false;
        if (category && b.category !== category) return false;
        return true;
      });
    },

    async create(input: {
      name: string;
      content: Block[];
      category?: string;
    }): Promise<SavedBlock> {
      const now = new Date().toISOString();
      const created: SavedBlock = {
        id: generateId(),
        name: input.name,
        content: input.content,
        ...(input.category ? { category: input.category } : {}),
        created_at: now,
        updated_at: now,
      };
      // Newest-first, matching the order the composable applies locally after
      // a create — so a reload preserves what the user just saw.
      writeAll([created, ...readAll()]);
      return created;
    },

    async update(
      id: string,
      patch: Partial<{ name: string; content: Block[]; category: string }>,
    ): Promise<SavedBlock> {
      const all = readAll();
      const index = all.findIndex((b) => b.id === id);
      // Mirrors a REST 404 so provider behavior is consistent across adapters.
      if (index === -1) {
        throw new Error(`[Templatical] Saved block not found: ${id}`);
      }
      const updated: SavedBlock = {
        ...all[index],
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const next = [...all];
      next[index] = updated;
      writeAll(next);
      return updated;
    },

    async delete(id: string): Promise<void> {
      const all = readAll();
      if (!all.some((b) => b.id === id)) {
        throw new Error(`[Templatical] Saved block not found: ${id}`);
      }
      writeAll(all.filter((b) => b.id !== id));
    },
  };
}
