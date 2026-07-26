import type {
  Block,
  SavedBlock,
  SavedBlocksProvider,
} from "@templatical/types";
import { ref, type Ref } from "vue";

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
  load: (search?: string) => Promise<void>;
  create: (name: string, content: Block[]) => Promise<SavedBlock>;
  update: (
    id: string,
    patch: Partial<{ name: string; content: Block[] }>,
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

  async function load(search?: string): Promise<void> {
    isLoading.value = true;
    try {
      savedBlocks.value = await provider.list({ search });
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function create(name: string, content: Block[]): Promise<SavedBlock> {
    try {
      const created = await provider.create({ name, content });
      savedBlocks.value = [created, ...savedBlocks.value];
      return created;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async function update(
    id: string,
    patch: Partial<{ name: string; content: Block[] }>,
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

  return { savedBlocks, isLoading, load, create, update, remove };
}
