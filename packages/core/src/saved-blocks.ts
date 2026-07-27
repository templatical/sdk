import type {
  Block,
  SavedBlock,
  SavedBlocksListParams,
  SavedBlocksProvider,
} from "@templatical/types";
import { computed, ref, type ComputedRef, type Ref } from "vue";

export interface UseSavedBlocksOptions {
  /**
   * Storage backend. Supplied by the consumer via `init({ savedBlocks })`, or
   * by Cloud's own adapter — this composable is transport-agnostic and never
   * talks to a network itself.
   */
  provider: SavedBlocksProvider;
  onError?: (error: Error) => void;
}

export interface UseSavedBlocksReturn {
  /** In-memory mirror of the provider's list, kept in sync after each call. */
  savedBlocks: Ref<SavedBlock[]>;
  isLoading: Ref<boolean>;
  /**
   * Distinct categories across the loaded entries, alphabetically sorted.
   *
   * Derived rather than stored: a category exists exactly as long as an entry
   * carries it. Sorting here is not a violation of "the editor never re-sorts"
   * — that rule protects the provider's ordering of *entries*, whereas these
   * are strings with no given order.
   */
  categories: ComputedRef<string[]>;
  /**
   * Re-read from the provider. The editor always calls this bare and filters
   * in memory; `params` exists for headless callers that want the provider to
   * filter instead (see {@link SavedBlocksListParams}).
   */
  load: (params?: SavedBlocksListParams) => Promise<void>;
  create: (
    name: string,
    content: Block[],
    category?: string,
  ) => Promise<SavedBlock>;
  update: (
    id: string,
    patch: Partial<{ name: string; content: Block[]; category: string }>,
  ) => Promise<SavedBlock>;
  remove: (id: string) => Promise<void>;
}

/**
 * Reactive state over a {@link SavedBlocksProvider}.
 *
 * Owns the list, the loading flag, and the local mutations that keep the list
 * consistent after each successful call, so a provider only has to implement
 * four promise-returning methods. Errors are reported through `onError` and
 * re-thrown, leaving the local list untouched on failure.
 */
export function useSavedBlocks(
  options: UseSavedBlocksOptions,
): UseSavedBlocksReturn {
  const { provider } = options;

  const savedBlocks = ref<SavedBlock[]>([]);
  const isLoading = ref(false);

  const categories = computed(() => {
    const seen = new Set<string>();
    for (const block of savedBlocks.value) {
      const category = block.category?.trim();
      if (category) seen.add(category);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  });

  async function load(params?: SavedBlocksListParams): Promise<void> {
    isLoading.value = true;
    try {
      savedBlocks.value = await provider.list(params);
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function create(
    name: string,
    content: Block[],
    category?: string,
  ): Promise<SavedBlock> {
    try {
      // Omit the key entirely when unset, rather than sending `undefined` —
      // a provider serialising the input to JSON would otherwise be handed an
      // explicit null-ish field it never asked for.
      const created = await provider.create(
        category ? { name, content, category } : { name, content },
      );
      savedBlocks.value = [created, ...savedBlocks.value];
      return created;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async function update(
    id: string,
    patch: Partial<{ name: string; content: Block[]; category: string }>,
  ): Promise<SavedBlock> {
    try {
      const updated = await provider.update(id, patch);
      savedBlocks.value = savedBlocks.value.map((b) =>
        b.id === id ? updated : b,
      );
      return updated;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await provider.delete(id);
      savedBlocks.value = savedBlocks.value.filter((b) => b.id !== id);
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  return { savedBlocks, isLoading, categories, load, create, update, remove };
}
