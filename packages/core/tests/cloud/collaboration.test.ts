import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useCollaboration } from '../../src/cloud/collaboration';
import type { AuthManager } from '../../src/cloud/auth';
import type { UseEditorReturn } from '../../src/cloud/editor';
import type { PresenceChannel } from 'pusher-js';

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    userConfig: { id: 'my-user', name: 'Me', signature: 'sig' },
  } as unknown as AuthManager;
}

function createMockEditor(): UseEditorReturn {
  return {
    state: { selectedBlockId: null, content: { blocks: [], settings: {} } },
    addBlock: vi.fn(),
    updateBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    updateSettings: vi.fn(),
    setContent: vi.fn(),
    selectBlock: vi.fn(),
  } as unknown as UseEditorReturn;
}

describe('useCollaboration', () => {
  it('starts with empty collaborators', () => {
    const channel = ref<PresenceChannel | null>(null);
    const { collaborators } = useCollaboration({
      authManager: createMockAuthManager(),
      editor: createMockEditor(),
      channel,
    });

    expect(collaborators.value).toEqual([]);
  });

  it('starts with empty lockedBlocks', () => {
    const channel = ref<PresenceChannel | null>(null);
    const { lockedBlocks } = useCollaboration({
      authManager: createMockAuthManager(),
      editor: createMockEditor(),
      channel,
    });

    expect(lockedBlocks.value).toEqual(new Map());
  });

  it('_broadcastOperation does nothing when channel is null', () => {
    const channel = ref<PresenceChannel | null>(null);
    const { _broadcastOperation } = useCollaboration({
      authManager: createMockAuthManager(),
      editor: createMockEditor(),
      channel,
    });

    // Should not throw when channel is null
    expect(() =>
      _broadcastOperation({
        operation: 'update_block',
        block_id: 'b1',
        properties: { content: 'test' },
      }),
    ).not.toThrow();
  });

  it('_isProcessingRemoteOperation returns false initially', () => {
    const channel = ref<PresenceChannel | null>(null);
    const { _isProcessingRemoteOperation } = useCollaboration({
      authManager: createMockAuthManager(),
      editor: createMockEditor(),
      channel,
    });

    expect(_isProcessingRemoteOperation()).toBe(false);
  });

  describe('channel watcher', () => {
    function createMockChannel() {
      const handlers: Record<string, Function> = {};
      return {
        bind: vi.fn((event: string, handler: Function) => {
          handlers[event] = handler;
        }),
        unbind: vi.fn(),
        trigger: vi.fn(),
        members: {
          each: vi.fn(),
        },
        _handlers: handlers,
      } as unknown as PresenceChannel & { _handlers: Record<string, Function> };
    }

    it('binds events when channel is set', async () => {
      const channel = ref<PresenceChannel | null>(null);
      const mockChannel = createMockChannel();

      useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
      });

      channel.value = mockChannel;
      await nextTick();

      expect(mockChannel.bind).toHaveBeenCalledWith('pusher:member_added', expect.any(Function));
      expect(mockChannel.bind).toHaveBeenCalledWith('pusher:member_removed', expect.any(Function));
      expect(mockChannel.bind).toHaveBeenCalledWith('client-block_locked', expect.any(Function));
      expect(mockChannel.bind).toHaveBeenCalledWith('client-block_unlocked', expect.any(Function));
      expect(mockChannel.bind).toHaveBeenCalledWith('client-operation', expect.any(Function));
      expect(mockChannel.bind).toHaveBeenCalledWith('mcp-operation', expect.any(Function));
    });

    it('unbinds events when channel changes to null', async () => {
      const mockChannel = createMockChannel();
      const channel = ref<PresenceChannel | null>(mockChannel);

      useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
      });

      // Wait for initial binding
      await nextTick();

      channel.value = null;
      await nextTick();

      expect(mockChannel.unbind).toHaveBeenCalledWith('pusher:member_added');
      expect(mockChannel.unbind).toHaveBeenCalledWith('pusher:member_removed');
      expect(mockChannel.unbind).toHaveBeenCalledWith('client-block_locked');
      expect(mockChannel.unbind).toHaveBeenCalledWith('client-block_unlocked');
      expect(mockChannel.unbind).toHaveBeenCalledWith('client-operation');
      expect(mockChannel.unbind).toHaveBeenCalledWith('mcp-operation');
    });

    it('resets state when channel changes to null', async () => {
      const mockChannel = createMockChannel();
      const channel = ref<PresenceChannel | null>(mockChannel);

      const { collaborators, lockedBlocks } = useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
      });

      await nextTick();

      channel.value = null;
      await nextTick();

      expect(collaborators.value).toEqual([]);
      expect(lockedBlocks.value).toEqual(new Map());
    });

    it('calls onCollaboratorJoined when a member is added', async () => {
      const channel = ref<PresenceChannel | null>(null);
      const mockChannel = createMockChannel();
      const onCollaboratorJoined = vi.fn();

      useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
        onCollaboratorJoined,
      });

      channel.value = mockChannel;
      await nextTick();

      // Trigger the member_added handler
      const memberAddedHandler = mockChannel._handlers['pusher:member_added'];
      memberAddedHandler({ id: 'other-user', info: { id: 'other-user', name: 'Other', type: 'user' } });

      expect(onCollaboratorJoined).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'other-user', name: 'Other' }),
      );
    });

    it('does not add self as collaborator', async () => {
      const channel = ref<PresenceChannel | null>(null);
      const mockChannel = createMockChannel();
      const onCollaboratorJoined = vi.fn();

      const { collaborators } = useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
        onCollaboratorJoined,
      });

      channel.value = mockChannel;
      await nextTick();

      // Trigger the member_added handler with the same user ID as authManager
      const memberAddedHandler = mockChannel._handlers['pusher:member_added'];
      memberAddedHandler({ id: 'my-user', info: { id: 'my-user', name: 'Me', type: 'user' } });

      expect(collaborators.value).toEqual([]);
      expect(onCollaboratorJoined).not.toHaveBeenCalled();
    });

    it('broadcasts operation through the channel', async () => {
      const channel = ref<PresenceChannel | null>(null);
      const mockChannel = createMockChannel();

      const { _broadcastOperation } = useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
      });

      channel.value = mockChannel;
      await nextTick();

      const payload = { operation: 'update_block' as const, block_id: 'b1', properties: { content: 'test' } };
      _broadcastOperation(payload);

      expect(mockChannel.trigger).toHaveBeenCalledWith('client-operation', payload);
    });
  });
});
