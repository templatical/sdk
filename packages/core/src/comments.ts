import type {
  Comment,
  CommentAuthor,
  CommentChange,
  CommentInput,
  CommentPatch,
  CommentsListParams,
  CommentsProvider,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import {
  computed,
  onScopeDispose,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";
import { notifyHandler, wrapReportedError } from "./error-reporting";

export interface UseCommentsOptions {
  /**
   * Storage backend. Supplied by the consumer via `init({ comments })`, or by
   * Cloud's own adapter — this composable is transport-agnostic and never talks
   * to a network itself.
   */
  provider: CommentsProvider;
  /**
   * Which template's conversation this is. A getter rather than a value because a
   * session can outlive the template: `initCloud()` constructs the feature at
   * setup and only learns the id once `create()` / `load()` resolves.
   */
  getTemplateId: () => string | null;
  /**
   * Who is commenting, read at call time. `null` means the editor has no
   * identity, and every mutation refuses — an unattributable comment is worse
   * than no comment feature.
   */
  getUser: () => CommentAuthor | null;
  onError?: (error: Error) => void;
}

export interface UseCommentsReturn {
  /** Thread roots in the provider's order. Never re-sorted. */
  comments: Ref<Comment[]>;
  isLoading: Ref<boolean>;
  isSubmitting: Ref<boolean>;
  /** Whether the provider supplied each mutation at all. */
  canCreate: ComputedRef<boolean>;
  canUpdate: ComputedRef<boolean>;
  canDelete: ComputedRef<boolean>;
  canResolve: ComputedRef<boolean>;
  /** Roots plus replies. */
  totalCount: ComputedRef<number>;
  /** Unresolved roots — the badge on the trigger. */
  unresolvedCount: ComputedRef<number>;
  /** Comments per anchored block id, roots plus their replies. */
  commentCountByBlock: ComputedRef<Map<string, number>>;
  /** Re-read the list. The editor calls this bare; `params` is for headless callers. */
  load: (params?: CommentsListParams) => Promise<void>;
  /** Rejects with an {@link SdkError} when `create` is disabled or there is no user. */
  create: (input: CommentInput) => Promise<Comment>;
  /** Rejects with an {@link SdkError} when `update` is disabled or there is no user. */
  update: (commentId: string, patch: CommentPatch) => Promise<Comment>;
  /** Rejects with an {@link SdkError} when `delete` is disabled or there is no user. */
  remove: (commentId: string) => Promise<void>;
  /** Rejects with an {@link SdkError} when `setResolved` is disabled or there is no user. */
  setResolved: (commentId: string, resolved: boolean) => Promise<Comment>;
  /** Look one up by id, root or reply. `null` when it isn't loaded. */
  find: (commentId: string) => Comment | null;
  /** Whether this comment was written by the current user. */
  isOwn: (comment: Comment) => boolean;
  /**
   * Apply a change that arrived from {@link CommentsProvider.subscribe}. Public
   * so a consumer driving this headlessly can push their own transport into it.
   */
  applyRemoteCreate: (comment: Comment) => void;
  applyRemoteUpdate: (comment: Comment) => void;
  applyRemoteDelete: (commentId: string, parentId?: string | null) => void;
}

/**
 * Reactive state over a {@link CommentsProvider}.
 *
 * Owns the thread list, the loading flags, the local mutations that keep the list
 * consistent, and the derived counts the chrome renders. Errors are reported
 * through `onError` and **re-thrown**, leaving the list untouched on failure —
 * the same discipline as `useSavedBlocks` and `useVersionHistory`.
 *
 * Mutations **reject** when the provider withheld them rather than resolving to
 * `null`: a resolved promise reads as "saved" to whoever awaited it. Ask through
 * `canCreate` / `canUpdate` / `canDelete` / `canResolve` first — which is what the
 * editor's own UI does, hiding each action rather than disabling it.
 */
export function useComments(options: UseCommentsOptions): UseCommentsReturn {
  const { provider, getTemplateId, getUser } = options;

  const comments = ref<Comment[]>([]);
  const isLoading = ref(false);
  const isSubmitting = ref(false);

  const canCreate = computed(() => typeof provider.create === "function");
  const canUpdate = computed(() => typeof provider.update === "function");
  const canDelete = computed(() => typeof provider.delete === "function");
  const canResolve = computed(() => typeof provider.setResolved === "function");

  const totalCount = computed(() =>
    comments.value.reduce(
      (sum, thread) => sum + 1 + (thread.replies?.length ?? 0),
      0,
    ),
  );

  const unresolvedCount = computed(
    () => comments.value.filter((thread) => !thread.resolvedAt).length,
  );

  const commentCountByBlock = computed(() => {
    const map = new Map<string, number>();
    for (const thread of comments.value) {
      if (!thread.blockId) continue;
      map.set(
        thread.blockId,
        (map.get(thread.blockId) ?? 0) + 1 + (thread.replies?.length ?? 0),
      );
    }
    return map;
  });

  /**
   * The UI hides disabled actions and renders nothing before a template exists,
   * so reaching one of these means a programmatic caller went around it. Fail
   * loudly rather than silently no-op.
   */
  function requireTemplateId(action: string): string {
    const templateId = getTemplateId();
    if (!templateId) {
      throw new SdkError(
        `[Templatical] Comments: ${action} needs a template. Call create() or load() first.`,
      );
    }
    return templateId;
  }

  function requireUser(action: string): CommentAuthor {
    const user = getUser();
    if (!user) {
      throw new SdkError(
        `[Templatical] Comments: ${action} needs to know who is commenting. Pass init({ user: { id, name } }) — an unattributed comment is not written.`,
      );
    }
    return user;
  }

  function refuse(action: string): never {
    throw new SdkError(
      `[Templatical] Comments: ${action} is disabled by the provider. Check the capability before calling — the editor's own UI hides the action.`,
    );
  }

  function find(commentId: string): Comment | null {
    for (const thread of comments.value) {
      if (thread.id === commentId) return thread;
      for (const reply of thread.replies ?? []) {
        if (reply.id === commentId) return reply;
      }
    }
    return null;
  }

  function isOwn(comment: Comment): boolean {
    const user = getUser();
    return user !== null && comment.author.id === user.id;
  }

  function report(error: unknown): never {
    const wrapped = wrapReportedError(error);
    options.onError?.(wrapped);
    throw wrapped;
  }

  /**
   * Run a consumer's event handler without letting it fail the operation.
   *
   * A handler that throws must not turn a completed write into a rejected one —
   * the UI would report a failure for a comment that was created.
   */
  function notify(run: () => void): void {
    notifyHandler(options.onError, run);
  }

  function replaceAt<T>(list: T[], index: number, next: T): T[] {
    return [...list.slice(0, index), next, ...list.slice(index + 1)];
  }

  /**
   * Key-order sensitive: identical fields serialized in a different order
   * compare unequal, so an echo whose transport frame orders keys
   * differently than the mutation response it echoes would not be
   * suppressed. Accepted rather than a defect — not worth a deep-equal
   * dependency for it.
   */
  function sameComment(a: Comment | undefined, b: Comment): boolean {
    return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * Insert a comment, replacing an entry with the same id rather than
   * duplicating it, and report whether the list actually changed.
   *
   * The **remote** apply paths (`applyRemoteCreate` / `applyRemoteUpdate`)
   * emit their event only when this returns `true`. A transport's own
   * broadcast can come back to the sender — `CommentsProvider.subscribe`'s
   * contract permits it — and emitting unconditionally fires the handler
   * twice for one comment. The comparison below runs against the **merged**
   * result, never the raw payload: the root branch keeps already-loaded
   * `replies` when an update payload carries none, so comparing the payload
   * directly would report a change for an echo that altered nothing.
   * Deleting the `sameComment` check as a redundant no-op reinstates the
   * double-fire.
   */
  function upsert(comment: Comment): boolean {
    if (comment.parentId) {
      let changed = false;
      const next = comments.value.map((thread) => {
        if (thread.id !== comment.parentId) return thread;
        const replies = thread.replies ?? [];
        const at = replies.findIndex((reply) => reply.id === comment.id);
        if (at !== -1 && sameComment(replies[at], comment)) return thread;
        changed = true;
        return {
          ...thread,
          replies:
            at === -1 ? [...replies, comment] : replaceAt(replies, at, comment),
        };
      });
      // Assigned only when something actually changed: `.map()` always returns
      // a new array, and reassigning `comments.value` for a no-op echo would
      // still invalidate every computed reading it (`commentCountByBlock`
      // returns a new `Map` on each recompute) for nothing.
      if (changed) comments.value = next;
      return changed;
    }

    const at = comments.value.findIndex((thread) => thread.id === comment.id);
    if (at === -1) {
      comments.value = [...comments.value, comment];
      return true;
    }
    // A root arriving again keeps the replies already loaded: the update payload
    // for a body edit carries none, and dropping them would empty the thread.
    const next: Comment = {
      ...comment,
      replies: comment.replies ?? comments.value[at].replies,
    };
    if (sameComment(comments.value[at], next)) return false;
    comments.value = replaceAt(comments.value, at, next);
    return true;
  }

  function drop(commentId: string, parentId?: string | null): Comment | null {
    const existing = find(commentId);
    // `parentId` from the caller wins so a delete can be applied without the
    // comment being loaded — the subscribe path, on a thread never opened.
    const parent = parentId ?? existing?.parentId ?? null;

    if (parent) {
      comments.value = comments.value.map((thread) =>
        thread.id === parent
          ? {
              ...thread,
              replies: (thread.replies ?? []).filter((r) => r.id !== commentId),
            }
          : thread,
      );
    } else {
      comments.value = comments.value.filter((c) => c.id !== commentId);
    }
    return existing;
  }

  async function load(params?: CommentsListParams): Promise<void> {
    const templateId = requireTemplateId("list");
    isLoading.value = true;
    try {
      comments.value = await provider.list(templateId, params);
    } catch (error) {
      report(error);
    } finally {
      isLoading.value = false;
    }
  }

  async function create(input: CommentInput): Promise<Comment> {
    const { create: providerCreate } = provider;
    if (typeof providerCreate !== "function") refuse("create");
    const templateId = requireTemplateId("create");
    requireUser("create");
    isSubmitting.value = true;
    try {
      const created = await providerCreate(templateId, input);
      upsert(created);
      notify(() => provider.onCreated?.(created, { origin: "local" }));
      return created;
    } catch (error) {
      report(error);
    } finally {
      isSubmitting.value = false;
    }
  }

  async function update(
    commentId: string,
    patch: CommentPatch,
  ): Promise<Comment> {
    const { update: providerUpdate } = provider;
    if (typeof providerUpdate !== "function") refuse("update");
    const templateId = requireTemplateId("update");
    requireUser("update");
    isSubmitting.value = true;
    try {
      const updated = await providerUpdate(templateId, commentId, patch);
      upsert(updated);
      notify(() => provider.onUpdated?.(updated, { origin: "local" }));
      return updated;
    } catch (error) {
      report(error);
    } finally {
      isSubmitting.value = false;
    }
  }

  async function remove(commentId: string): Promise<void> {
    const { delete: providerDelete } = provider;
    if (typeof providerDelete !== "function") refuse("delete");
    const templateId = requireTemplateId("delete");
    requireUser("delete");
    // Snapshotted before the request: the event carries what was deleted, and
    // there is nothing to read afterwards.
    const existing = find(commentId);
    isSubmitting.value = true;
    try {
      await providerDelete(templateId, commentId);
      drop(commentId);
      if (existing) {
        notify(() => provider.onDeleted?.(existing, { origin: "local" }));
      }
    } catch (error) {
      report(error);
    } finally {
      isSubmitting.value = false;
    }
  }

  async function setResolved(
    commentId: string,
    resolved: boolean,
  ): Promise<Comment> {
    const { setResolved: providerSetResolved } = provider;
    if (typeof providerSetResolved !== "function") refuse("setResolved");
    const templateId = requireTemplateId("setResolved");
    requireUser("setResolved");
    isSubmitting.value = true;
    try {
      const updated = await providerSetResolved(
        templateId,
        commentId,
        resolved,
      );
      upsert(updated);
      // The stored result decides which event fires, not the requested state: a
      // store may refuse to reopen, and the consumer should hear what happened.
      notify(() =>
        (updated.resolvedAt ? provider.onResolved : provider.onUnresolved)?.(
          updated,
          { origin: "local" },
        ),
      );
      return updated;
    } catch (error) {
      report(error);
    } finally {
      isSubmitting.value = false;
    }
  }

  function applyRemoteCreate(comment: Comment): void {
    // A reply whose parent thread isn't loaded reports nothing: `upsert`
    // finds no matching thread to attach it to, so the list doesn't change.
    if (upsert(comment)) {
      notify(() => provider.onCreated?.(comment, { origin: "remote" }));
    }
  }

  function applyRemoteUpdate(comment: Comment): void {
    if (!upsert(comment)) return;
    notify(() =>
      (comment.resolvedAt
        ? provider.onResolved
        : // An unresolve and a body edit are both "not resolved"; only a payload
          // that used to be resolved is an unresolve, and the transport doesn't
          // say. `updated` is the honest answer for a plain change.
          provider.onUpdated)?.(comment, { origin: "remote" }),
    );
  }

  function applyRemoteDelete(
    commentId: string,
    parentId?: string | null,
  ): void {
    const existing = drop(commentId, parentId);
    if (existing) {
      notify(() => provider.onDeleted?.(existing, { origin: "remote" }));
    }
  }

  return {
    comments,
    isLoading,
    isSubmitting,
    canCreate,
    canUpdate,
    canDelete,
    canResolve,
    totalCount,
    unresolvedCount,
    commentCountByBlock,
    load,
    create,
    update,
    remove,
    setResolved,
    find,
    isOwn,
    applyRemoteCreate,
    applyRemoteUpdate,
    applyRemoteDelete,
  };
}

export interface UseCommentListenerOptions {
  comments: UseCommentsReturn;
  provider: CommentsProvider;
  getTemplateId: () => string | null;
}

/**
 * Wire {@link CommentsProvider.subscribe} into the three `applyRemote*` paths.
 *
 * A no-op when the provider has no `subscribe` — realtime is optional, and
 * comments without it work exactly the same except that a colleague's comment
 * only appears on the next read. Nothing here knows about a transport: Cloud's
 * Pusher channel lives inside `createCloudCommentsProvider`, and an SSE or
 * long-poll implementation is the same three lines on the consumer's side.
 *
 * Re-subscribes when the template id changes, and unsubscribes on scope dispose —
 * so a session that loads a second template does not keep receiving the first
 * one's comments.
 */
export function useCommentListener(options: UseCommentListenerOptions): void {
  const { comments, provider, getTemplateId } = options;
  const { subscribe } = provider;
  if (typeof subscribe !== "function") return;

  let unsubscribe: (() => void) | null = null;

  function stop(): void {
    unsubscribe?.();
    unsubscribe = null;
  }

  watch(
    () => getTemplateId(),
    (templateId) => {
      stop();
      if (!templateId) return;
      unsubscribe = subscribe(templateId, (change: CommentChange) => {
        switch (change.type) {
          case "created":
            comments.applyRemoteCreate(change.comment);
            break;
          case "updated":
            comments.applyRemoteUpdate(change.comment);
            break;
          case "deleted":
            comments.applyRemoteDelete(change.commentId, change.parentId);
            break;
        }
      });
    },
    { immediate: true },
  );

  onScopeDispose(stop);
}
