import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { useComments, useCommentListener } from "@templatical/core";
import type { UseCommentsReturn } from "@templatical/core";
import type { CommentsProvider, EditorUser } from "@templatical/types";
import type { EditorCapabilities } from "../types/editor-capabilities";

/** Minimal slice of the editor this feature needs. */
interface CommentsEditor {
  state: {
    readonly template?: { id: string } | null;
  };
}

export interface UseCommentsFeatureOptions {
  /** Storage backend supplied by the consumer. */
  provider: CommentsProvider;
  editor: CommentsEditor;
  /**
   * Who is commenting (`init({ user })`). **Without one the feature reports
   * itself unavailable** — see {@link isAvailable}.
   */
  user?: EditorUser | null;
  onError?: (error: Error) => void;
}

export interface UseCommentsFeatureReturn {
  headless: UseCommentsReturn;

  isOpen: Ref<boolean>;
  isAvailable: ComputedRef<boolean>;
  /** True once a template exists — comments are keyed to one. */
  hasTemplate: ComputedRef<boolean>;
  unresolvedCount: ComputedRef<number>;

  /**
   * The block the panel should filter to, or `null` for no block filter. Owned
   * here rather than in the panel because a block's comment indicator sets it
   * *before* the lazy panel exists.
   */
  filterBlockId: Ref<string | null>;

  /** Toggle the panel. A no-op while unavailable. */
  toggle: () => void;
  close: () => void;
  /** Open the panel filtered to one block — what the canvas indicator calls. */
  openForBlock: (blockId: string) => void;

  capability: NonNullable<EditorCapabilities["comments"]>;
}

/**
 * Shared glue for comments: the reactive thread list, the panel's open and filter
 * state, and the capability the shared chrome gates on.
 *
 * The editor constructs this from `init({ comments })`. A configured provider
 * and user determine availability; this feature does not manage authentication.
 *
 * Threads load when a template becomes available so the header badge and
 * per-block indicators reflect the provider. Opening the panel re-reads them
 * to pick up changes made elsewhere.
 */
export function useCommentsFeature(
  options: UseCommentsFeatureOptions,
): UseCommentsFeatureReturn {
  const { provider, editor } = options;

  const headless = useComments({
    provider,
    getTemplateId: () => editor.state.template?.id ?? null,
    // Read through a getter: a consumer may change `user` after setup, and a
    // snapshot would keep attributing comments to the previous user.
    getUser: () => options.user ?? null,
    onError: options.onError,
  });

  // Provider-driven realtime, or nothing at all when the provider has no
  // `subscribe`. It is deliberately wired here rather than inside `useComments`:
  // the subscription is a lifecycle concern (it follows the template and must be
  // torn down), and `useComments` is state.
  useCommentListener({
    comments: headless,
    provider,
    getTemplateId: () => editor.state.template?.id ?? null,
  });

  const isOpen = ref(false);
  const filterBlockId = ref<string | null>(null);

  const hasTemplate = computed(() => !!editor.state.template?.id);
  const unresolvedCount = headless.unresolvedCount;

  const isAvailable = computed(() => {
    // No identity ⇒ unavailable, never anonymous. Every comment carries an author
    // and an unattributable one is worse than no comment feature.
    if (!options.user) return false;
    return true;
  });

  // Close an open panel when the feature becomes unavailable, for example when
  // a consumer clears `user`.
  watch(isAvailable, (available) => {
    if (!available) isOpen.value = false;
  });

  // Load as soon as there is a template, not just when the panel opens. Unlike
  // saved blocks or version history — whose lists are read only by the surface
  // that fetches them — two indicators *outside* this panel derive from the whole
  // list: `unresolvedCount` feeds the header badge, and `commentCountByBlock`
  // feeds the per-block canvas markers. Deferring the fetch left both at zero, so
  // a template arriving with existing comments showed no sign of them anywhere
  // until the user happened to click Comments, and the badge then popped into
  // existence — the same "reads 0, then pops" failure that cost the saved-blocks
  // rail its count.
  //
  // Loading the lot up front is already the design's assumption: `comments.list`
  // is deliberately unpaginated precisely because those two aggregates are
  // computed over every thread.
  watch(
    [isAvailable, hasTemplate],
    ([available, attached]) => {
      if (!available || !attached) return;
      void headless.load().catch(() => {
        /* reported through onError */
      });
    },
    { immediate: true },
  );

  // Every open re-reads. History and comments both grow elsewhere, so a list
  // fetched once goes stale silently; only a *first* open has nothing to show
  // meanwhile, which the panel distinguishes for its skeleton.
  watch(isOpen, (open) => {
    if (!open || !hasTemplate.value) return;
    void headless.load().catch(() => {
      /* reported through onError */
    });
  });

  function toggle(): void {
    if (!isAvailable.value) return;
    isOpen.value = !isOpen.value;
  }

  function close(): void {
    isOpen.value = false;
  }

  function openForBlock(blockId: string): void {
    if (!isAvailable.value) return;
    filterBlockId.value = blockId;
    // Assigning `true` to an already-true ref fires no watcher, so an indicator
    // clicked while the panel is open must refresh explicitly — otherwise moving
    // between blocks shows a list read before the last change.
    if (isOpen.value) {
      if (hasTemplate.value) {
        void headless.load().catch(() => {
          /* reported through onError */
        });
      }
      return;
    }
    isOpen.value = true;
  }

  return {
    headless,

    isOpen,
    isAvailable,
    hasTemplate,
    unresolvedCount,

    filterBlockId,

    toggle,
    close,
    openForBlock,

    capability: {
      getBlockCount: (blockId: string) =>
        headless.commentCountByBlock.value.get(blockId) ?? 0,
      openForBlock,
      isAvailable,
      unresolvedCount,
      canCreate: headless.canCreate,
      canUpdate: headless.canUpdate,
      canDelete: headless.canDelete,
      canResolve: headless.canResolve,
    },
  };
}
