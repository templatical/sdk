import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { useComments, useCommentListener } from "@templatical/core";
import type { UseCommentsReturn } from "@templatical/core";
import type {
  CommentEvent,
  CommentsProvider,
  EditorUser,
} from "@templatical/types";
import type { EditorCapabilities } from "../types/editor-capabilities";

/** Minimal slice of the editor this feature needs — OSS and Cloud alike. */
interface CommentsEditor {
  state: {
    readonly template?: { id: string } | null;
  };
}

export interface UseCommentsFeatureOptions {
  /** Storage backend — consumer-supplied in OSS, the Cloud adapter in Cloud. */
  provider: CommentsProvider;
  editor: CommentsEditor;
  /**
   * Who is commenting (`init({ user })`). **Without one the feature reports
   * itself unavailable** — see {@link isAvailable}.
   */
  user?: EditorUser | null;
  /**
   * The panel's open state. Cloud passes its own so comments stay mutually
   * exclusive with the AI and scoring sidebars, which share the same 360px
   * gutter; OSS gets a local ref.
   */
  isOpen?: Ref<boolean>;
  onComment?: (event: CommentEvent) => void;
  onError?: (error: Error) => void;
  /**
   * Extra gate on top of a provider and a user being present — Cloud adds its
   * `commenting` plan entitlement and "the template must be saved". Read
   * reactively, so a Cloud entitlement that resolves after setup still lights the
   * feature up.
   */
  isAvailable?: () => boolean;
  /**
   * Whether a block id exists in the **stored** template. Cloud supplies this: a
   * comment is anchored server-side, so filtering to a block that only exists on
   * the canvas has nothing to show. Absent means "assume it does", which is right
   * for a store that accepts any anchor.
   */
  isBlockSaved?: (blockId: string) => boolean;
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
 * Both entry points construct this — OSS from `init({ comments })`, Cloud from
 * `createCloudCommentsProvider` — so the two run identical logic over different
 * transports. Nothing here is auth- or plan-aware; callers decide availability.
 *
 * **Nothing is fetched at mount.** The list is read when the panel opens, matching
 * saved blocks: a review panel nobody opens should cost no round-trip, and the
 * unresolved badge is worth less than a request on every editor boot.
 */
export function useCommentsFeature(
  options: UseCommentsFeatureOptions,
): UseCommentsFeatureReturn {
  const { provider, editor } = options;

  const headless = useComments({
    provider,
    getTemplateId: () => editor.state.template?.id ?? null,
    // Read through a getter, never destructured: Cloud fills `user` from the JWT
    // and a consumer may swap it, and the same lesson as `allowedRecipients`
    // applies — a snapshot at setup pins the answer forever.
    getUser: () => options.user ?? null,
    onComment: options.onComment,
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

  const isOpen = options.isOpen ?? ref(false);
  const filterBlockId = ref<string | null>(null);

  const hasTemplate = computed(() => !!editor.state.template?.id);
  const unresolvedCount = headless.unresolvedCount;

  const isAvailable = computed(() => {
    // No identity ⇒ unavailable, never anonymous. Every comment carries an author
    // and an unattributable one is worse than no comment feature.
    if (!options.user) return false;
    return options.isAvailable?.() ?? true;
  });

  // A panel left open when the feature goes away — a Cloud plan fetch that
  // withholds `commenting`, or a consumer clearing `user` — would sit there with
  // no trigger to close it.
  watch(isAvailable, (available) => {
    if (!available) isOpen.value = false;
  });

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
      // Absent means "any anchor is fine", which is the right default for a store
      // that accepts one. Cloud supplies the real check because it renders from
      // the saved template.
      isBlockSaved: (blockId: string) =>
        options.isBlockSaved?.(blockId) ?? true,
      isAvailable,
      unresolvedCount,
      canCreate: headless.canCreate,
      canUpdate: headless.canUpdate,
      canDelete: headless.canDelete,
      canResolve: headless.canResolve,
    },
  };
}
