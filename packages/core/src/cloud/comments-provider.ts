import type {
  Comment,
  CommentChange,
  CommentInput,
  CommentPatch,
  CommentResponse,
  CommentsProvider,
  CommentsListResult,
  UserConfig,
} from "@templatical/types";
import { watch, type Ref } from "vue";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";

/**
 * The two methods this adapter needs from a Pusher channel, named structurally.
 *
 * Deliberately not `PresenceChannel`: `pusher-js` is an **optional** peer of this
 * package, so a type imported from it would make `@templatical/editor` — which
 * holds the channel ref for us — fail to typecheck without it installed. A
 * `PresenceChannel` satisfies this shape, so nothing at the call site changes.
 */
export interface RealtimeChannel {
  bind(event: string, handler: (payload: any) => void): unknown;
  unbind(event: string, handler?: (payload: any) => void): unknown;
}

/** The Pusher event Cloud's backend fans comment writes out on. */
const BROADCAST_EVENT = "comment-broadcast";

interface CommentBroadcastPayload {
  action:
    | "comment_created"
    | "comment_updated"
    | "comment_deleted"
    | "comment_resolved"
    | "comment_unresolved";
  comment: CommentResponse;
}

/**
 * Cloud's wire shape → the contract shape. The whole job of this adapter, plus
 * auth: snake_case to camelCase, and the two flat `author_*` / `resolved_by_*`
 * pairs into {@link CommentAuthor} objects.
 */
function toComment(record: CommentResponse): Comment {
  const comment: Comment = {
    id: record.id,
    body: record.body,
    author: { id: record.author_identifier, name: record.author_name },
    createdAt: record.created_at,
    blockId: record.block_id,
    parentId: record.parent_id,
    resolvedAt: record.resolved_at,
  };

  // Cloud stamps `updated_at` on creation, so forwarding it unconditionally would
  // mark every comment "(edited)". The contract says the key is present *only*
  // when the body has changed since.
  if (record.updated_at !== record.created_at) {
    comment.updatedAt = record.updated_at;
  }
  if (record.resolved_by_identifier) {
    comment.resolvedBy = {
      id: record.resolved_by_identifier,
      name: record.resolved_by_name ?? "",
    };
  }
  if (record.replies?.length) {
    comment.replies = record.replies.map(toComment);
  }
  return comment;
}

export interface CreateCloudCommentsProviderOptions {
  authManager: AuthManager;
  /**
   * Cloud's presence channel for the open template, or `null` before it joins.
   *
   * A ref rather than a value because the channel arrives after the template
   * loads and is replaced when another one is opened — {@link subscribe} watches
   * it and rebinds, which is what keeps realtime optional from the editor's point
   * of view: the contract only ever sees `subscribe`.
   */
  channel: Ref<RealtimeChannel | null>;
  /**
   * The socket id to stamp on writes, so Cloud's backend can skip echoing them
   * back to their author. Returns `null` before the socket connects.
   */
  getSocketId?: () => string | null;
}

/**
 * Cloud-backed {@link CommentsProvider} — the Templatical Cloud adapter for the
 * same review contract consumers implement themselves.
 *
 * All four mutations are enabled: comment storage and its realtime fan-out are
 * what the `commenting` plan feature pays for, so there is no Cloud tier that can
 * read a thread but not reply to it. A consumer who wants a read-only review
 * supplies their own provider with the mutations set to `false`.
 *
 * Two things about the write payloads are Cloud's alone and stay on this side of
 * the seam:
 *
 * - **The author is signed.** `user_id` / `user_name` / `user_signature` come from
 *   the JWT, not from the editor's `user` config, so a browser cannot attribute a
 *   comment to someone else. The editor's `user` key still gates the feature and
 *   drives "you wrote this" in the UI; the two agree because `initCloud()` fills
 *   `user` from the same JWT.
 * - **`X-Socket-ID`.** Cloud excludes the originating socket from the broadcast,
 *   which is why a local write and its echo can't double-post. Every implementation
 *   is nonetheless echo-safe (`upsert` replaces by id), so a backend without that
 *   header is fine too.
 */
export function createCloudCommentsProvider(
  options: CreateCloudCommentsProviderOptions,
): CommentsProvider {
  const { authManager, channel, getSocketId } = options;
  const api = new ApiClient(authManager);

  function userPayload(): {
    user_id: string;
    user_name: string;
    user_signature: string;
  } {
    const user: UserConfig | null = authManager.userConfig;
    if (!user) {
      // Unreachable through the editor — `initCloud()` derives its `user` config
      // from this same field, so the feature is unavailable without it and no
      // action renders. A headless caller can still get here.
      throw new Error(
        "[Templatical] Cloud comments need a signed user in the auth token. The project's token endpoint must include a `user` claim.",
      );
    }
    return {
      user_id: user.id,
      user_name: user.name,
      user_signature: user.signature,
    };
  }

  function socketHeaders(): Record<string, string> | undefined {
    const socketId = getSocketId?.();
    return socketId ? { "X-Socket-ID": socketId } : undefined;
  }

  return {
    async list(templateId: string): Promise<CommentsListResult> {
      const records = await api.getComments(templateId);
      // No `nextCursor`: Cloud returns every thread for the template in one
      // response, so there is never a further page to ask for.
      return { comments: records.map(toComment) };
    },

    async create(templateId: string, input: CommentInput): Promise<Comment> {
      return toComment(
        await api.createComment(
          templateId,
          {
            body: input.body,
            block_id: input.blockId,
            parent_id: input.parentId,
            ...userPayload(),
          },
          socketHeaders(),
        ),
      );
    },

    async update(
      templateId: string,
      commentId: string,
      patch: CommentPatch,
    ): Promise<Comment> {
      if (patch.body === undefined) {
        // `body` is the only editable field, so an empty patch has nothing to
        // send. Refuse rather than PUT an undefined body over a real one.
        throw new Error(
          "[Templatical] Cloud comments: update() needs a `body` in the patch.",
        );
      }
      return toComment(
        await api.updateComment(
          templateId,
          commentId,
          { body: patch.body, ...userPayload() },
          socketHeaders(),
        ),
      );
    },

    async delete(templateId: string, commentId: string): Promise<void> {
      await api.deleteComment(
        templateId,
        commentId,
        userPayload(),
        socketHeaders(),
      );
    },

    async setResolved(
      templateId: string,
      commentId: string,
      _resolved: boolean,
    ): Promise<Comment> {
      // Cloud's endpoint toggles server-side, so the requested state is not sent.
      // The response is authoritative either way, and `useComments` fires its
      // event off `resolvedAt` in that response rather than off what was asked —
      // so a disagreement surfaces as the truth rather than as a wrong event.
      return toComment(
        await api.resolveComment(
          templateId,
          commentId,
          userPayload(),
          socketHeaders(),
        ),
      );
    },

    subscribe(
      _templateId: string,
      onChange: (change: CommentChange) => void,
    ): () => void {
      function handle(payload: CommentBroadcastPayload): void {
        const comment = toComment(payload.comment);
        switch (payload.action) {
          case "comment_created":
            onChange({ type: "created", comment });
            break;
          case "comment_deleted":
            onChange({
              type: "deleted",
              commentId: comment.id,
              parentId: comment.parentId,
            });
            break;
          // A resolve and an unresolve are both a changed comment; `resolvedAt`
          // in the payload is what says which, and `useComments` reads it.
          case "comment_updated":
          case "comment_resolved":
          case "comment_unresolved":
            onChange({ type: "updated", comment });
            break;
        }
      }

      // The channel is joined when the template loads, i.e. after this provider is
      // built, and is replaced when another template is opened — so the binding
      // follows the ref rather than being made once. `_templateId` is unused
      // because Cloud's channel *is* per-template: a channel change already means
      // a template change.
      const stopWatching = watch(
        channel,
        (next, previous) => {
          previous?.unbind(BROADCAST_EVENT, handle);
          next?.bind(BROADCAST_EVENT, handle);
        },
        { immediate: true },
      );

      return () => {
        stopWatching();
        // The watcher only unbinds on a *transition*; without this the handler
        // stays attached to the current channel and keeps mutating a torn-down
        // list.
        channel.value?.unbind(BROADCAST_EVENT, handle);
      };
    },
  };
}
