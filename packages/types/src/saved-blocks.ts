import type { Block } from "./blocks";

/**
 * A reusable, user-authored group of blocks — saved from the canvas and
 * re-insertable into any template.
 *
 * Distinct from a *custom block* (`CustomBlockDefinition`), which is a
 * developer-defined block **type** with its own template and field schema.
 * A saved block is an instance-level snapshot of ordinary blocks.
 */
export interface SavedBlock {
  /**
   * Store-assigned identifier. Returned by {@link SavedBlocksProvider.create}
   * — the editor never generates it, so the store stays the authority on
   * identity (database primary key, storage slug, etc.).
   */
  id: string;
  name: string;
  /**
   * Top-level blocks captured in this saved block. A `section` carries its own
   * `children`, so a whole section-with-columns round-trips as one entry.
   *
   * Blocks are re-identified on insert (via `cloneBlock`), so the IDs stored
   * here never collide with the blocks already on a canvas.
   */
  content: Block[];
  /**
   * Store-assigned timestamps, used for display only: the browser shows a
   * relative "5m ago" label per entry (preferring `updated_at`, falling back
   * to `created_at`) with the absolute date on hover.
   *
   * They do **not** affect ordering — the editor renders whatever order
   * `list()` returns and never re-sorts. Both are optional; omit them and the
   * label is simply not shown.
   */
  created_at?: string;
  updated_at?: string;
}

/**
 * Parameters for {@link SavedBlocksProvider.list}. An object (rather than
 * positional arguments) so future filters can be added without breaking
 * existing provider implementations.
 */
export interface SavedBlocksListParams {
  /**
   * Free-text filter over the saved block's `name`. Matching is the provider's
   * responsibility — server-side implementations typically push this into the
   * query, local ones filter in memory.
   */
  search?: string;
}

/**
 * Storage contract for saved blocks. Implement it to back the editor's saved
 * blocks UI with your own persistence — the editor owns the save dialog, the
 * browser, and insertion; you own the transport.
 *
 * Pass an implementation as `savedBlocks` to `init()`. When omitted, the
 * feature stays off entirely and none of its UI renders.
 *
 * Every method may reject; the editor surfaces the failure through the
 * editor's `onError` callback and leaves its in-memory list untouched.
 *
 * ```ts
 * const provider: SavedBlocksProvider = {
 *   list: ({ search } = {}) =>
 *     fetch(`/api/saved-blocks?search=${search ?? ""}`).then((r) => r.json()),
 *   create: (input) =>
 *     fetch("/api/saved-blocks", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify(input),
 *     }).then((r) => r.json()),
 *   update: (id, patch) =>
 *     fetch(`/api/saved-blocks/${id}`, {
 *       method: "PUT",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify(patch),
 *     }).then((r) => r.json()),
 *   delete: (id) =>
 *     fetch(`/api/saved-blocks/${id}`, { method: "DELETE" }).then(() => undefined),
 * };
 * ```
 */
export interface SavedBlocksProvider {
  /** Fetch all saved blocks, optionally filtered. */
  list(params?: SavedBlocksListParams): Promise<SavedBlock[]>;
  /** Persist a new saved block and return it with its store-assigned `id`. */
  create(input: { name: string; content: Block[] }): Promise<SavedBlock>;
  /**
   * Apply a partial update and return the stored result. Renaming is
   * `update(id, { name })` — there is no separate rename method.
   */
  update(
    id: string,
    patch: Partial<{ name: string; content: Block[] }>,
  ): Promise<SavedBlock>;
  /** Remove a saved block. Resolves once the store has applied the delete. */
  delete(id: string): Promise<void>;
}
