import type {
  Comment,
  CommentEvent,
  CommentThread,
  UserConfig,
} from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";
import { computed, ref, type ComputedRef, type Ref } from "vue";

export interface UseCommentsOptions {
  authManager: AuthManager;
  getTemplateId: () => string | null;
  getSocketId?: () => string | null;
  onComment?: (event: CommentEvent) => void;
  onError?: (error: Error) => void;
  isAuthReady?: Ref<boolean>;
  hasCommentingFeature?: () => boolean;
}

export interface UseCommentsReturn {
  comments: Ref<CommentThread[]>;
  isLoading: Ref<boolean>;
  isSubmitting: Ref<boolean>;
  isEnabled: ComputedRef<boolean>;
  commentCountByBlock: ComputedRef<Map<string, number>>;
  totalCount: ComputedRef<number>;
  unresolvedCount: ComputedRef<number>;
  loadComments: () => Promise<void>;
  addComment: (
    body: string,
    blockId?: string,
    parentId?: string,
  ) => Promise<Comment | null>;
  editComment: (commentId: string, body: string) => Promise<Comment | null>;
  removeComment: (commentId: string) => Promise<boolean>;
  toggleResolve: (commentId: string) => Promise<Comment | null>;
  applyRemoteCreate: (comment: Comment) => void;
  applyRemoteUpdate: (comment: Comment) => void;
  applyRemoteDelete: (commentId: string, parentId: string | null) => void;
}

export function useComments(options: UseCommentsOptions): UseCommentsReturn {
  const {
    authManager,
    getTemplateId,
    getSocketId,
    onComment,
    onError,
    hasCommentingFeature,
  } = options;

  const api = new ApiClient(authManager);
  const comments = ref<CommentThread[]>([]);
  const isLoading = ref(false);
  const isSubmitting = ref(false);

  const isEnabled = computed<boolean>(() => {
    const featureAvailable = hasCommentingFeature?.() ?? false;
    return featureAvailable && authManager.userConfig !== null;
  });

  const totalCount = computed<number>(() => {
    let count = 0;
    for (const thread of comments.value) {
      count += 1 + (thread.replies?.length ?? 0);
    }
    return count;
  });

  const unresolvedCount = computed<number>(() => {
    return comments.value.filter((c) => !c.resolved_at).length;
  });

  const commentCountByBlock = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const thread of comments.value) {
      if (thread.block_id) {
        map.set(
          thread.block_id,
          (map.get(thread.block_id) ?? 0) + 1 + (thread.replies?.length ?? 0),
        );
      }
    }
    return map;
  });

  function getUserPayload(): {
    user_id: string;
    user_name: string;
    user_signature: string;
  } {
    const user: UserConfig | null = authManager.userConfig;
    if (!user) {
      throw new Error("User config not available");
    }
    return {
      user_id: user.id,
      user_name: user.name,
      user_signature: user.signature,
    };
  }

  function socketHeaders(): Record<string, string> | undefined {
    const socketId = getSocketId?.();
    if (!socketId) {
      return undefined;
    }
    return { "X-Socket-ID": socketId };
  }

  function emitEvent(type: CommentEvent["type"], comment: Comment): void {
    onComment?.({ type, comment });
  }

  function findComment(commentId: string): Comment | null {
    for (const thread of comments.value) {
      if (thread.id === commentId) {
        return thread;
      }
      for (const reply of thread.replies ?? []) {
        if (reply.id === commentId) {
          return reply;
        }
      }
    }
    return null;
  }

  async function loadComments(): Promise<void> {
    const templateId = getTemplateId();
    if (!templateId) {
      return;
    }

    isLoading.value = true;

    try {
      comments.value = await api.getComments(templateId);
    } catch (err) {
      const wrappedError =
        err instanceof Error
          ? err
          : new Error("Failed to load comments", { cause: err });
      onError?.(wrappedError);
    } finally {
      isLoading.value = false;
    }
  }

  async function addComment(
    body: string,
    blockId?: string,
    parentId?: string,
  ): Promise<Comment | null> {
    const templateId = getTemplateId();
    if (!templateId) {
      return null;
    }

    isSubmitting.value = true;

    try {
      const comment = await api.createComment(
        templateId,
        {
          body,
          block_id: blockId,
          parent_id: parentId,
          ...getUserPayload(),
        },
        socketHeaders(),
      );

      if (parentId) {
        const parent = findComment(parentId);
        if (parent) {
          parent.replies = [...(parent.replies ?? []), comment];
        }
      } else {
        comments.value = [...comments.value, comment];
      }

      emitEvent("created", comment);
      return comment;
    } catch (err) {
      const wrappedError =
        err instanceof Error
          ? err
          : new Error("Failed to create comment", { cause: err });
      onError?.(wrappedError);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function editComment(
    commentId: string,
    body: string,
  ): Promise<Comment | null> {
    const templateId = getTemplateId();
    if (!templateId) {
      return null;
    }

    isSubmitting.value = true;

    try {
      const updated = await api.updateComment(
        templateId,
        commentId,
        {
          body,
          ...getUserPayload(),
        },
        socketHeaders(),
      );

      updateCommentInState(commentId, updated);
      emitEvent("updated", updated);
      return updated;
    } catch (err) {
      const wrappedError =
        err instanceof Error
          ? err
          : new Error("Failed to update comment", { cause: err });
      onError?.(wrappedError);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function removeComment(commentId: string): Promise<boolean> {
    const templateId = getTemplateId();
    if (!templateId) {
      return false;
    }

    const comment = findComment(commentId);
    if (!comment) {
      return false;
    }

    const commentSnapshot = {
      ...comment,
      replies: [...(comment.replies ?? [])],
    };

    isSubmitting.value = true;

    try {
      await api.deleteComment(
        templateId,
        commentId,
        getUserPayload(),
        socketHeaders(),
      );

      if (comment.parent_id) {
        const parent = findComment(comment.parent_id);
        if (parent) {
          parent.replies = (parent.replies ?? []).filter(
            (r) => r.id !== commentId,
          );
        }
      } else {
        comments.value = comments.value.filter((c) => c.id !== commentId);
      }

      emitEvent("deleted", commentSnapshot);
      return true;
    } catch (err) {
      const wrappedError =
        err instanceof Error
          ? err
          : new Error("Failed to delete comment", { cause: err });
      onError?.(wrappedError);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function toggleResolve(commentId: string): Promise<Comment | null> {
    const templateId = getTemplateId();
    if (!templateId) {
      return null;
    }

    isSubmitting.value = true;

    try {
      const updated = await api.resolveComment(
        templateId,
        commentId,
        getUserPayload(),
        socketHeaders(),
      );

      updateCommentInState(commentId, updated);

      const eventType = updated.resolved_at ? "resolved" : "unresolved";
      emitEvent(eventType, updated);
      return updated;
    } catch (err) {
      const wrappedError =
        err instanceof Error
          ? err
          : new Error("Failed to toggle comment resolution", { cause: err });
      onError?.(wrappedError);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  function applyRemoteCreate(comment: Comment): void {
    if (comment.parent_id) {
      const parent = findComment(comment.parent_id);
      if (parent) {
        parent.replies = [...(parent.replies ?? []), comment];
      }
    } else {
      comments.value = [...comments.value, comment];
    }
    emitEvent("created", comment);
  }

  function applyRemoteUpdate(comment: Comment): void {
    updateCommentInState(comment.id, comment);
    emitEvent("updated", comment);
  }

  function applyRemoteDelete(commentId: string, parentId: string | null): void {
    const comment = findComment(commentId);
    const snapshot = comment
      ? { ...comment, replies: [...(comment.replies ?? [])] }
      : null;

    if (parentId) {
      const parent = findComment(parentId);
      if (parent) {
        parent.replies = (parent.replies ?? []).filter(
          (r) => r.id !== commentId,
        );
      }
    } else {
      comments.value = comments.value.filter((c) => c.id !== commentId);
    }

    if (snapshot) {
      emitEvent("deleted", snapshot);
    }
  }

  function updateCommentInState(commentId: string, updated: Comment): void {
    for (let i = 0; i < comments.value.length; i++) {
      if (comments.value[i].id === commentId) {
        comments.value = [
          ...comments.value.slice(0, i),
          { ...updated, replies: comments.value[i].replies },
          ...comments.value.slice(i + 1),
        ];
        return;
      }

      const replies = comments.value[i].replies ?? [];
      for (let j = 0; j < replies.length; j++) {
        if (replies[j].id === commentId) {
          const newReplies = [
            ...replies.slice(0, j),
            updated,
            ...replies.slice(j + 1),
          ];
          comments.value = [
            ...comments.value.slice(0, i),
            { ...comments.value[i], replies: newReplies },
            ...comments.value.slice(i + 1),
          ];
          return;
        }
      }
    }
  }

  return {
    comments,
    isLoading,
    isSubmitting,
    isEnabled,
    commentCountByBlock,
    totalCount,
    unresolvedCount,
    loadComments,
    addComment,
    editComment,
    removeComment,
    toggleResolve,
    applyRemoteCreate,
    applyRemoteUpdate,
    applyRemoteDelete,
  };
}
