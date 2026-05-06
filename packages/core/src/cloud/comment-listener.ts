import type { UseCommentsReturn } from "./comments";
import type { Comment } from "@templatical/types";
import type { PresenceChannel } from "pusher-js";
import { onScopeDispose, watch, type Ref } from "vue";

export interface CommentBroadcastPayload {
  action:
    | "comment_created"
    | "comment_updated"
    | "comment_deleted"
    | "comment_resolved"
    | "comment_unresolved";
  comment: Comment;
}

export interface UseCommentListenerOptions {
  comments: UseCommentsReturn;
  channel: Ref<PresenceChannel | null>;
}

export function useCommentListener(options: UseCommentListenerOptions): void {
  const { comments, channel } = options;

  watch(channel, (newChannel, oldChannel) => {
    if (oldChannel) {
      oldChannel.unbind("comment-broadcast");
    }

    if (newChannel) {
      newChannel.bind(
        "comment-broadcast",
        (payload: CommentBroadcastPayload) => {
          handleCommentBroadcast(comments, payload);
        },
      );
    }
  });

  // The watch only unbinds on channel *transitions*. On scope dispose the
  // currently-bound handler stays attached, processing broadcasts on a
  // dead component. Explicitly tear it down.
  onScopeDispose(() => {
    channel.value?.unbind("comment-broadcast");
  });
}

function handleCommentBroadcast(
  comments: UseCommentsReturn,
  payload: CommentBroadcastPayload,
): void {
  switch (payload.action) {
    case "comment_created":
      comments.applyRemoteCreate(payload.comment);
      break;
    case "comment_updated":
      comments.applyRemoteUpdate(payload.comment);
      break;
    case "comment_deleted":
      comments.applyRemoteDelete(payload.comment.id, payload.comment.parent_id);
      break;
    case "comment_resolved":
    case "comment_unresolved":
      comments.applyRemoteUpdate(payload.comment);
      break;
  }
}
