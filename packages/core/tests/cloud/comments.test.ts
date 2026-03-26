import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useComments } from '../../src/cloud/comments';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import type { Comment, CommentThread } from '@templatical/types';

vi.mock('../../src/cloud/api');

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    userConfig: { id: 'user-1', name: 'Test User', signature: 'sig-1' },
  } as unknown as AuthManager;
}

function createComment(id: string, overrides: Partial<Comment> = {}): Comment {
  return {
    id,
    body: `Comment ${id}`,
    block_id: null,
    parent_id: null,
    resolved_at: null,
    user_id: 'user-1',
    user_name: 'Test User',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  } as Comment;
}

function createThread(id: string, overrides: Partial<CommentThread> = {}): CommentThread {
  return {
    ...createComment(id),
    replies: [],
    ...overrides,
  } as CommentThread;
}

describe('useComments', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
  });

  it('starts with empty state', () => {
    const { comments, isLoading, isSubmitting } = useComments({
      authManager: createMockAuthManager(),
      getTemplateId: () => 'tmpl-1',
    });

    expect(comments.value).toEqual([]);
    expect(isLoading.value).toBe(false);
    expect(isSubmitting.value).toBe(false);
  });

  describe('isEnabled', () => {
    it('returns true when feature available and user config present', () => {
      const { isEnabled } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        hasCommentingFeature: () => true,
      });

      expect(isEnabled.value).toBe(true);
    });

    it('returns false when feature not available', () => {
      const { isEnabled } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        hasCommentingFeature: () => false,
      });

      expect(isEnabled.value).toBe(false);
    });

    it('returns false when no user config', () => {
      const auth = createMockAuthManager();
      (auth as any).userConfig = null;

      const { isEnabled } = useComments({
        authManager: auth,
        getTemplateId: () => 'tmpl-1',
        hasCommentingFeature: () => true,
      });

      expect(isEnabled.value).toBe(false);
    });
  });

  describe('computed counts', () => {
    it('counts total comments including replies', () => {
      const { comments, totalCount } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [
        createThread('c1', { replies: [createComment('r1'), createComment('r2')] }),
        createThread('c2', { replies: [createComment('r3')] }),
      ];

      expect(totalCount.value).toBe(5); // 2 threads + 3 replies
    });

    it('counts unresolved threads', () => {
      const { comments, unresolvedCount } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [
        createThread('c1'),
        createThread('c2', { resolved_at: '2024-01-02' } as any),
        createThread('c3'),
      ];

      expect(unresolvedCount.value).toBe(2);
    });

    it('counts comments per block', () => {
      const { comments, commentCountByBlock } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [
        createThread('c1', { block_id: 'b1', replies: [createComment('r1')] } as any),
        createThread('c2', { block_id: 'b1' } as any),
        createThread('c3', { block_id: 'b2' } as any),
      ];

      expect(commentCountByBlock.value.get('b1')).toBe(3); // thread + reply + thread
      expect(commentCountByBlock.value.get('b2')).toBe(1);
    });
  });

  describe('loadComments', () => {
    it('loads comments from API', async () => {
      const threads = [createThread('c1'), createThread('c2')];
      vi.mocked(ApiClient.prototype.getComments).mockResolvedValue(threads);

      const { comments, loadComments } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      await loadComments();

      expect(comments.value).toEqual(threads);
    });

    it('skips load when no template ID', async () => {
      const getCommentsMock = vi.mocked(ApiClient.prototype.getComments);
      const callCountBefore = getCommentsMock.mock.calls.length;

      const { loadComments } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => null,
      });

      await loadComments();

      expect(getCommentsMock.mock.calls.length - callCountBefore).toBe(0);
    });

    it('manages isLoading state', async () => {
      vi.mocked(ApiClient.prototype.getComments).mockResolvedValue([]);

      const { isLoading, loadComments } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      const promise = loadComments();
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('calls onError on failure', async () => {
      vi.mocked(ApiClient.prototype.getComments).mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { loadComments } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onError,
      });

      await loadComments();

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('addComment', () => {
    it('adds a top-level comment', async () => {
      const newComment = createComment('c1');
      vi.mocked(ApiClient.prototype.createComment).mockResolvedValue(newComment);

      const onComment = vi.fn();
      const { comments, addComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      const result = await addComment('Hello');

      expect(result).toEqual(newComment);
      expect(comments.value).toHaveLength(1);
      expect(onComment).toHaveBeenCalledWith({ type: 'created', comment: newComment });
    });

    it('adds a reply to existing thread', async () => {
      const reply = createComment('r1', { parent_id: 'c1' });
      vi.mocked(ApiClient.prototype.createComment).mockResolvedValue(reply);

      const { comments, addComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [createThread('c1')];

      await addComment('Reply', undefined, 'c1');

      expect(comments.value[0].replies).toHaveLength(1);
      expect(comments.value[0].replies![0]).toEqual(reply);
    });

    it('returns null when no template ID', async () => {
      const { addComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => null,
      });

      const result = await addComment('Hello');
      expect(result).toBeNull();
    });

    it('passes socket ID header', async () => {
      vi.mocked(ApiClient.prototype.createComment).mockResolvedValue(createComment('c1'));

      const { addComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        getSocketId: () => 'socket-123',
      });

      await addComment('Hello');

      expect(ApiClient.prototype.createComment).toHaveBeenCalledWith(
        'tmpl-1',
        expect.any(Object),
        { 'X-Socket-ID': 'socket-123' },
      );
    });
  });

  describe('editComment', () => {
    it('updates comment in state', async () => {
      const updated = createComment('c1', { body: 'Updated' } as any);
      vi.mocked(ApiClient.prototype.updateComment).mockResolvedValue(updated);

      const onComment = vi.fn();
      const { comments, editComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      comments.value = [createThread('c1', { body: 'Original' } as any)];

      const result = await editComment('c1', 'Updated');

      expect(result).toEqual(updated);
      expect(comments.value[0].body).toBe('Updated');
      expect(onComment).toHaveBeenCalledWith({ type: 'updated', comment: updated });
    });

    it('updates reply in state', async () => {
      const updatedReply = createComment('r1', { body: 'Updated reply', parent_id: 'c1' });
      vi.mocked(ApiClient.prototype.updateComment).mockResolvedValue(updatedReply);

      const { comments, editComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [
        createThread('c1', {
          replies: [createComment('r1', { body: 'Original reply', parent_id: 'c1' })],
        }),
      ];

      await editComment('r1', 'Updated reply');

      expect(comments.value[0].replies![0].body).toBe('Updated reply');
    });
  });

  describe('removeComment', () => {
    it('removes a top-level thread', async () => {
      vi.mocked(ApiClient.prototype.deleteComment).mockResolvedValue(undefined);

      const onComment = vi.fn();
      const { comments, removeComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      comments.value = [createThread('c1'), createThread('c2')];

      const result = await removeComment('c1');

      expect(result).toBe(true);
      expect(comments.value).toHaveLength(1);
      expect(comments.value[0].id).toBe('c2');
      expect(onComment).toHaveBeenCalledWith({
        type: 'deleted',
        comment: expect.objectContaining({ id: 'c1' }),
      });
    });

    it('removes a reply from a thread', async () => {
      vi.mocked(ApiClient.prototype.deleteComment).mockResolvedValue(undefined);

      const { comments, removeComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [
        createThread('c1', {
          replies: [
            createComment('r1', { parent_id: 'c1' }),
            createComment('r2', { parent_id: 'c1' }),
          ],
        }),
      ];

      await removeComment('r1');

      expect(comments.value[0].replies).toHaveLength(1);
      expect(comments.value[0].replies![0].id).toBe('r2');
    });

    it('returns false when comment not found', async () => {
      const { removeComment } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      const result = await removeComment('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('toggleResolve', () => {
    it('emits resolved event when comment becomes resolved', async () => {
      const resolved = createComment('c1', { resolved_at: '2024-01-02' } as any);
      vi.mocked(ApiClient.prototype.resolveComment).mockResolvedValue(resolved);

      const onComment = vi.fn();
      const { comments, toggleResolve } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      comments.value = [createThread('c1')];

      await toggleResolve('c1');

      expect(onComment).toHaveBeenCalledWith({ type: 'resolved', comment: resolved });
    });

    it('emits unresolved event when comment becomes unresolved', async () => {
      const unresolved = createComment('c1', { resolved_at: null } as any);
      vi.mocked(ApiClient.prototype.resolveComment).mockResolvedValue(unresolved);

      const onComment = vi.fn();
      const { comments, toggleResolve } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      comments.value = [createThread('c1', { resolved_at: '2024-01-02' } as any)];

      await toggleResolve('c1');

      expect(onComment).toHaveBeenCalledWith({ type: 'unresolved', comment: unresolved });
    });
  });

  describe('remote operations', () => {
    it('applyRemoteCreate adds top-level comment', () => {
      const onComment = vi.fn();
      const { comments, applyRemoteCreate } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      const comment = createComment('c1');
      applyRemoteCreate(comment);

      expect(comments.value).toHaveLength(1);
      expect(onComment).toHaveBeenCalledWith({ type: 'created', comment });
    });

    it('applyRemoteCreate adds reply to thread', () => {
      const { comments, applyRemoteCreate } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [createThread('c1')];

      const reply = createComment('r1', { parent_id: 'c1' });
      applyRemoteCreate(reply);

      expect(comments.value[0].replies).toHaveLength(1);
    });

    it('applyRemoteUpdate updates comment in state', () => {
      const onComment = vi.fn();
      const { comments, applyRemoteUpdate } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      comments.value = [createThread('c1', { body: 'Original' } as any)];

      const updated = createComment('c1', { body: 'Updated' } as any);
      applyRemoteUpdate(updated);

      expect(comments.value[0].body).toBe('Updated');
      expect(onComment).toHaveBeenCalledWith({ type: 'updated', comment: updated });
    });

    it('applyRemoteDelete removes top-level comment', () => {
      const onComment = vi.fn();
      const { comments, applyRemoteDelete } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        onComment,
      });

      comments.value = [createThread('c1'), createThread('c2')];

      applyRemoteDelete('c1', null);

      expect(comments.value).toHaveLength(1);
      expect(comments.value[0].id).toBe('c2');
      expect(onComment).toHaveBeenCalledWith({
        type: 'deleted',
        comment: expect.objectContaining({ id: 'c1' }),
      });
    });

    it('applyRemoteDelete removes reply', () => {
      const { comments, applyRemoteDelete } = useComments({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
      });

      comments.value = [
        createThread('c1', {
          replies: [createComment('r1', { parent_id: 'c1' })],
        }),
      ];

      applyRemoteDelete('r1', 'c1');

      expect(comments.value[0].replies).toHaveLength(0);
    });
  });
});
