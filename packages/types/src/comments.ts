/**
 * Who wrote a comment, or resolved one.
 *
 * The same shape as {@link EditorUser}, and deliberately so — a comment's author
 * is whoever was editing. It is a separate name only because a store returns
 * authors it did not get from this session.
 */
export interface CommentAuthor {
  id: string;
  name: string;
}

/**
 * One comment — a thread root, or a reply to one.
 *
 * Threads are **one level deep**: a root carries {@link replies}, and a reply
 * never does. That is what the editor renders, and flattening a deeper tree is
 * your store's problem rather than the editor's.
 */
export interface Comment {
  /** Store-assigned. The editor never generates one. */
  id: string;
  body: string;
  author: CommentAuthor;
  /** ISO 8601. */
  createdAt: string;
  /**
   * ISO 8601, present only when the body has been edited since. Drives the
   * "(edited)" marker, so a store that stamps it on creation makes every comment
   * look edited.
   */
  updatedAt?: string;
  /**
   * The block this comment is anchored to, or `null` for a comment about the
   * template as a whole.
   */
  blockId?: string | null;
  /** The thread root this is a reply to, or `null` for a root. */
  parentId?: string | null;
  /** ISO 8601 when resolved; `null` or absent while the thread is open. */
  resolvedAt?: string | null;
  /** Who resolved it. Absent when unresolved, or when your store doesn't track it. */
  resolvedBy?: CommentAuthor | null;
  /** Replies to this root, oldest first. Absent or empty on a reply. */
  replies?: Comment[];
}

/** What {@link CommentsProvider.create} is asked to store. */
export interface CommentInput {
  body: string;
  /** Omitted for a template-level comment. */
  blockId?: string;
  /** Omitted for a thread root. */
  parentId?: string;
}

/**
 * Partial patch for {@link CommentsProvider.update}. A patch rather than a bare
 * body, matching `TemplatePatch` and `SavedBlockPatch` — retrofitting one later
 * would break every implementation, and only the shape is being paid for now.
 */
export type CommentPatch = Partial<{
  body: string;
}>;

/**
 * Reserved filter object for {@link CommentsProvider.list}.
 *
 * Empty today. The editor always calls `list` bare and narrows in memory
 * (unresolved / all / this block), so the provider decides *what is visible*
 * and the editor decides how it is filtered within that.
 *
 * **Not a pagination hook, and comments deliberately has none.** `useComments`
 * derives `unresolvedCount` (the header badge) and `commentCountByBlock` (the
 * per-block canvas indicators) over the *whole* loaded list. A partial page
 * would make both under-report silently — wrong rather than slow. Correct
 * paging would mean moving counts and filtering server-side, which is a
 * redesign, not a `loadMore()`. A long-lived template caps its own growth by
 * having `list()` stop returning resolved threads past some age; the panel
 * hides those by default anyway. Contrast {@link VersionHistoryListParams},
 * which does page: its list is a flat menu with nothing aggregating over it.
 */
export interface CommentsListParams {}

/**
 * One remote change, as reported by {@link CommentsProvider.subscribe}.
 *
 * A discriminated union rather than a `{ type, comment }` pair, because a delete
 * has no comment to carry — only the id, plus the parent so the editor knows
 * which list to remove it from without looking it up first.
 */
export type CommentChange =
  | { type: "created"; comment: Comment }
  | { type: "updated"; comment: Comment }
  | { type: "deleted"; commentId: string; parentId?: string | null };

export type CommentEventType =
  "created" | "updated" | "deleted" | "resolved" | "unresolved";

/**
 * What `onComment` receives — every change the editor applied, local or remote.
 *
 * Distinct from {@link CommentChange}: that is what a *transport* reports inward,
 * this is what the editor reports outward, and it separates `resolved` /
 * `unresolved` from a plain `updated` because a consumer notifying a team cares
 * about the difference.
 */
export interface CommentEvent {
  type: CommentEventType;
  comment: Comment;
}

/**
 * Storage contract for **comments** — the review conversation on a template.
 *
 * Pass an implementation as `comments` to `init()`. With no provider the panel,
 * its trigger and the per-block indicators do not render and none of that UI is
 * downloaded.
 *
 * Comments also need to know **who is commenting**, which is not part of this
 * contract: it is the top-level `user` config key, because collaboration presence
 * will want the same answer and a provider-local copy would be the first thing to
 * drift. With no `user` the feature reports itself unavailable — an
 * unattributable comment is worse than no comment feature.
 *
 * **Each mutation can be turned off by passing `false` instead of a function**,
 * mirroring `SavedBlocksProvider`, `TemplatesProvider` and
 * `VersionHistoryProvider`. They are required rather than optional precisely so
 * that disabling is a decision you state, never something you get by forgetting a
 * method. All four `false` yields a read-only review: existing threads are
 * browsable and jump-to-block still works, with no way to add, edit, delete or
 * resolve.
 *
 * ```ts
 * const provider: CommentsProvider = {
 *   list: (templateId) =>
 *     fetch(`/api/templates/${templateId}/comments`).then((r) => r.json()),
 *   create: (templateId, input) =>
 *     fetch(`/api/templates/${templateId}/comments`, {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify(input),
 *     }).then((r) => r.json()),
 *   update: (templateId, commentId, patch) =>
 *     fetch(`/api/templates/${templateId}/comments/${commentId}`, {
 *       method: "PATCH",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify(patch),
 *     }).then((r) => r.json()),
 *   delete: async (templateId, commentId) => {
 *     await fetch(`/api/templates/${templateId}/comments/${commentId}`, {
 *       method: "DELETE",
 *     });
 *   },
 *   setResolved: (templateId, commentId, resolved) =>
 *     fetch(`/api/templates/${templateId}/comments/${commentId}/resolve`, {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ resolved }),
 *     }).then((r) => r.json()),
 * };
 * ```
 */
export interface CommentsProvider {
  /**
   * The thread roots to show, each with its `replies`. The editor renders this
   * order verbatim and never re-sorts — ordering is your store's call.
   *
   * The one method that cannot be disabled: without it there is nothing to show.
   */
  list(templateId: string, params?: CommentsListParams): Promise<Comment[]>;
  /**
   * Store a new comment or reply and return it with its store-assigned `id`, or
   * `false` to make the review read-only.
   */
  create:
    false | ((templateId: string, input: CommentInput) => Promise<Comment>);
  /**
   * Apply a partial update and return the stored result, or `false` to disable
   * editing — the pencil action then does not render on any comment.
   */
  update:
    | false
    | ((
        templateId: string,
        commentId: string,
        patch: CommentPatch,
      ) => Promise<Comment>);
  /**
   * Remove a comment (and, for a root, its replies), or `false` to disable
   * deletion. Resolves to nothing: there is no post-delete state to report.
   */
  delete: false | ((templateId: string, commentId: string) => Promise<void>);
  /**
   * Mark a thread resolved or reopened and return the stored result, or `false`
   * to disable it.
   *
   * Takes the **target state** rather than toggling, so the call is idempotent
   * and a store that receives two clicks in flight cannot end up inverted.
   */
  setResolved:
    | false
    | ((
        templateId: string,
        commentId: string,
        resolved: boolean,
      ) => Promise<Comment>);
  /**
   * **Optional.** Push remote changes into the open panel, so a colleague's
   * comment appears without a reload.
   *
   * Realtime is separable from comments rather than a prerequisite for them:
   * without this the feature works exactly as it does with it, you just don't see
   * someone else's comment until the list is next read. Returns an unsubscribe
   * function; the editor calls it when the template changes and on teardown.
   *
   * ```ts
   * subscribe: (templateId, onChange) => {
   *   const source = new EventSource(`/api/templates/${templateId}/comments/stream`);
   *   source.onmessage = (e) => onChange(JSON.parse(e.data) as CommentChange);
   *   return () => source.close();
   * }
   * ```
   *
   * Your own writes may echo back through here. That is fine and needs no
   * de-duplication on your side: a `created` for a comment already in the list is
   * ignored, and an `updated` replaces it in place.
   */
  subscribe?: (
    templateId: string,
    onChange: (change: CommentChange) => void,
  ) => () => void;
}
