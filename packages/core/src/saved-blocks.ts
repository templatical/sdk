import type {
  Block,
  SavedBlock,
  SavedBlockPatch,
  SavedBlocksListParams,
  SavedBlocksProvider,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import { computed, ref, type ComputedRef, type Ref } from "vue";
import { notifyHandler } from "./error-reporting";

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
   * Whether the provider supplied each mutation at all — `false` on the
   * provider means the capability does not exist for this user, and the UI
   * hides the corresponding affordance entirely.
   *
   * Constant for the provider's lifetime, but exposed as computed refs so
   * consumers can bind them the same way as everything else here.
   */
  canCreate: ComputedRef<boolean>;
  canUpdate: ComputedRef<boolean>;
  canDelete: ComputedRef<boolean>;
  /**
   * Whether a *particular* entry may be edited / deleted: the capability must
   * exist AND the entry must not opt out via `canUpdate` / `canDelete`.
   *
   * Use these rather than reading the flags directly, so every surface asks the
   * question the same way and the "absent means allowed" default lives in one
   * place.
   */
  canUpdateBlock: (block: SavedBlock) => boolean;
  canDeleteBlock: (block: SavedBlock) => boolean;
  /**
   * Re-read from the provider. The editor always calls this bare and filters
   * in memory; `params` exists for headless callers that want the provider to
   * filter instead (see {@link SavedBlocksListParams}).
   */
  load: (params?: SavedBlocksListParams) => Promise<void>;
  /** Rejects with an {@link SdkError} when the provider disabled `create`. */
  create: (
    name: string,
    content: Block[],
    category?: string,
  ) => Promise<SavedBlock>;
  /** Rejects when `update` is disabled or the entry opts out of editing. */
  update: (id: string, patch: SavedBlockPatch) => Promise<SavedBlock>;
  /** Rejects when `delete` is disabled or the entry opts out of deletion. */
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

  const canCreate = computed(() => typeof provider.create === "function");
  const canUpdate = computed(() => typeof provider.update === "function");
  const canDelete = computed(() => typeof provider.delete === "function");

  /** Absent flag means allowed — the flags exist only to forbid. */
  function canUpdateBlock(block: SavedBlock): boolean {
    return canUpdate.value && block.canUpdate !== false;
  }

  function canDeleteBlock(block: SavedBlock): boolean {
    return canDelete.value && block.canDelete !== false;
  }

  /**
   * The UI hides disabled actions, so reaching one of these means a programmatic
   * caller went around it. Fail loudly rather than silently no-op: a resolved
   * promise would read as "saved" to whoever awaited it.
   */
  function refuse(action: string, reason: string): never {
    throw new SdkError(
      `[Templatical] Saved blocks: ${action} is ${reason}. Check the capability before calling — the editor's own UI hides the action.`,
    );
  }

  /**
   * Run a consumer's event handler without letting it fail the operation.
   *
   * A handler that throws must not turn a completed write into a rejected one —
   * the UI would report a failure for a saved block that was created.
   */
  function notify(run: () => void): void {
    notifyHandler(options.onError, run);
  }

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
    const { create: providerCreate } = provider;
    if (typeof providerCreate !== "function") {
      refuse("create", "disabled by the provider");
    }
    try {
      // Omit the key entirely when unset, rather than sending `undefined` —
      // a provider serialising the input to JSON would otherwise be handed an
      // explicit null-ish field it never asked for.
      const created = await providerCreate(
        category ? { name, content, category } : { name, content },
      );
      savedBlocks.value = [created, ...savedBlocks.value];
      notify(() => provider.onCreated?.(created));
      return created;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async function update(
    id: string,
    patch: SavedBlockPatch,
  ): Promise<SavedBlock> {
    const { update: providerUpdate } = provider;
    if (typeof providerUpdate !== "function") {
      refuse("update", "disabled by the provider");
    }
    // An id absent from the local list isn't refused — a headless caller may
    // legitimately patch something it never loaded. Only a loaded entry that
    // explicitly opted out is blocked.
    const local = savedBlocks.value.find((b) => b.id === id);
    if (local && local.canUpdate === false) {
      refuse("update", `not permitted for entry "${id}"`);
    }
    try {
      const updated = await providerUpdate(id, patch);
      savedBlocks.value = savedBlocks.value.map((b) =>
        b.id === id ? updated : b,
      );
      notify(() => provider.onUpdated?.(updated));
      return updated;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async function remove(id: string): Promise<void> {
    const { delete: providerDelete } = provider;
    if (typeof providerDelete !== "function") {
      refuse("delete", "disabled by the provider");
    }
    // Captured before the delete resolves: `onDeleted` carries the removed
    // entry itself, and there is nothing left to read once the list is
    // filtered.
    const removed = savedBlocks.value.find((b) => b.id === id) ?? null;
    if (removed && removed.canDelete === false) {
      refuse("delete", `not permitted for entry "${id}"`);
    }
    try {
      await providerDelete(id);
      savedBlocks.value = savedBlocks.value.filter((b) => b.id !== id);
      if (removed) {
        notify(() => provider.onDeleted?.(removed));
      }
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  return {
    savedBlocks,
    isLoading,
    categories,
    canCreate,
    canUpdate,
    canDelete,
    canUpdateBlock,
    canDeleteBlock,
    load,
    create,
    update,
    remove,
  };
}
