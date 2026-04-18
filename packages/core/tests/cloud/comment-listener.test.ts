import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useCommentListener } from '../../src/cloud/comment-listener';
import type { UseCommentsReturn } from '../../src/cloud/comments';
import type { Comment } from '@templatical/types';
import type { PresenceChannel } from 'pusher-js';

function createMockComments(): UseCommentsReturn {
  return {
    comments: ref([]),
    isLoading: ref(false),
    isSubmitting: ref(false),
    isEnabled: { value: true } as any,
    commentCountByBlock: { value: new Map() } as any,
    totalCount: { value: 0 } as any,
    unresolvedCount: { value: 0 } as any,
    loadComments: vi.fn(),
    addComment: vi.fn(),
    editComment: vi.fn(),
    removeComment: vi.fn(),
    toggleResolve: vi.fn(),
    applyRemoteCreate: vi.fn(),
    applyRemoteUpdate: vi.fn(),
    applyRemoteDelete: vi.fn(),
  } as unknown as UseCommentsReturn;
}

function createMockChannel() {
  const handlers: Record<string, Function> = {};
  return {
    bind: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    unbind: vi.fn(),
    trigger: vi.fn(),
    _handlers: handlers,
  };
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

describe('useCommentListener', () => {
  it('binds comment-broadcast on channel set', async () => {
    const channel = ref<PresenceChannel | null>(null);
    const mockChannel = createMockChannel();

    useCommentListener({
      comments: createMockComments(),
      channel,
    });

    channel.value = mockChannel as unknown as PresenceChannel;
    await nextTick();

    expect(mockChannel.bind).toHaveBeenCalledWith('comment-broadcast', expect.any(Function));
  });

  it('unbinds on channel change', async () => {
    const mockChannel = createMockChannel();
    const channel = ref<PresenceChannel | null>(mockChannel as unknown as PresenceChannel);

    useCommentListener({
      comments: createMockComments(),
      channel,
    });

    await nextTick();

    channel.value = null;
    await nextTick();

    expect(mockChannel.unbind).toHaveBeenCalledWith('comment-broadcast');
  });

  it('dispatches comment_created to applyRemoteCreate', async () => {
    const channel = ref<PresenceChannel | null>(null);
    const mockChannel = createMockChannel();
    const comments = createMockComments();

    useCommentListener({ comments, channel });

    channel.value = mockChannel as unknown as PresenceChannel;
    await nextTick();

    const comment = createComment('c1');
    mockChannel._handlers['comment-broadcast']({
      action: 'comment_created',
      comment,
    });

    expect(comments.applyRemoteCreate).toHaveBeenCalledWith(comment);
  });

  it('dispatches comment_updated to applyRemoteUpdate', async () => {
    const channel = ref<PresenceChannel | null>(null);
    const mockChannel = createMockChannel();
    const comments = createMockComments();

    useCommentListener({ comments, channel });

    channel.value = mockChannel as unknown as PresenceChannel;
    await nextTick();

    const comment = createComment('c1', { body: 'Updated' } as any);
    mockChannel._handlers['comment-broadcast']({
      action: 'comment_updated',
      comment,
    });

    expect(comments.applyRemoteUpdate).toHaveBeenCalledWith(comment);
  });

  it('dispatches comment_deleted to applyRemoteDelete', async () => {
    const channel = ref<PresenceChannel | null>(null);
    const mockChannel = createMockChannel();
    const comments = createMockComments();

    useCommentListener({ comments, channel });

    channel.value = mockChannel as unknown as PresenceChannel;
    await nextTick();

    const comment = createComment('c1', { parent_id: 'p1' });
    mockChannel._handlers['comment-broadcast']({
      action: 'comment_deleted',
      comment,
    });

    expect(comments.applyRemoteDelete).toHaveBeenCalledWith('c1', 'p1');
  });

  it('dispatches comment_resolved to applyRemoteUpdate', async () => {
    const channel = ref<PresenceChannel | null>(null);
    const mockChannel = createMockChannel();
    const comments = createMockComments();

    useCommentListener({ comments, channel });

    channel.value = mockChannel as unknown as PresenceChannel;
    await nextTick();

    const comment = createComment('c1', { resolved_at: '2024-01-02' } as any);
    mockChannel._handlers['comment-broadcast']({
      action: 'comment_resolved',
      comment,
    });

    expect(comments.applyRemoteUpdate).toHaveBeenCalledWith(comment);
  });

  it('dispatches comment_unresolved to applyRemoteUpdate', async () => {
    const channel = ref<PresenceChannel | null>(null);
    const mockChannel = createMockChannel();
    const comments = createMockComments();

    useCommentListener({ comments, channel });

    channel.value = mockChannel as unknown as PresenceChannel;
    await nextTick();

    const comment = createComment('c1', { resolved_at: null });
    mockChannel._handlers['comment-broadcast']({
      action: 'comment_unresolved',
      comment,
    });

    expect(comments.applyRemoteUpdate).toHaveBeenCalledWith(comment);
  });

  it('rebinds when channel changes to a new channel', async () => {
    const channel = ref<PresenceChannel | null>(null);
    const mockChannel1 = createMockChannel();
    const mockChannel2 = createMockChannel();
    const comments = createMockComments();

    useCommentListener({ comments, channel });

    channel.value = mockChannel1 as unknown as PresenceChannel;
    await nextTick();

    channel.value = mockChannel2 as unknown as PresenceChannel;
    await nextTick();

    // First channel should be unbound
    expect(mockChannel1.unbind).toHaveBeenCalledWith('comment-broadcast');
    // Second channel should be bound
    expect(mockChannel2.bind).toHaveBeenCalledWith('comment-broadcast', expect.any(Function));
  });
});
