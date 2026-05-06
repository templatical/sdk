import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, reactive, nextTick, effectScope } from 'vue';
import { useCollaboration } from '../../src/cloud/collaboration';
import type { AuthManager } from '../../src/cloud/auth';
import type { UseEditorReturn } from '../../src/cloud/editor';
import type { PresenceChannel } from 'pusher-js';

vi.mock('../../src/cloud/mcp-operation-handler', () => ({
  handleOperation: vi.fn(),
}));

import { handleOperation } from '../../src/cloud/mcp-operation-handler';

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

    // Should silently skip when channel is null
    _broadcastOperation({
      operation: 'update_block',
      block_id: 'b1',
      properties: { content: 'test' },
    });
    // No channel means nothing was triggered — editor state should be unchanged
    expect(channel.value).toBeNull();
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

    it('unbinds events when the effect scope is disposed (component unmount)', async () => {
      const mockChannel = createMockChannel();
      const channel = ref<PresenceChannel | null>(null);
      const scope = effectScope();

      scope.run(() => {
        useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
        });
      });

      // Connect the channel so listeners get bound.
      channel.value = mockChannel;
      await nextTick();
      expect(mockChannel.bind).toHaveBeenCalled();

      // Component unmounts. The watch is auto-stopped by Vue, but the
      // currently-bound listeners stay attached to the channel forever
      // unless the composable wires its own scope-dispose cleanup.
      scope.stop();
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

    it('does not duplicate when adding same member twice', async () => {
      const channel = ref<PresenceChannel | null>(null);
      const mockChannel = createMockChannel();

      const { collaborators } = useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
      });

      channel.value = mockChannel;
      await nextTick();

      const memberAddedHandler = mockChannel._handlers['pusher:member_added'];
      memberAddedHandler({ id: 'user-2', info: { id: 'user-2', name: 'Alice', type: 'user' } });
      memberAddedHandler({ id: 'user-2', info: { id: 'user-2', name: 'Alice', type: 'user' } });

      expect(collaborators.value).toHaveLength(1);
      expect(collaborators.value[0].id).toBe('user-2');
    });

    it('removes collaborator and cleans up locked blocks on member_removed', async () => {
      const channel = ref<PresenceChannel | null>(null);
      const mockChannel = createMockChannel();
      const onCollaboratorLeft = vi.fn();

      const { collaborators, lockedBlocks } = useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
        onCollaboratorLeft,
      });

      channel.value = mockChannel;
      await nextTick();

      // Add a collaborator
      const memberAddedHandler = mockChannel._handlers['pusher:member_added'];
      memberAddedHandler({ id: 'user-2', info: { id: 'user-2', name: 'Alice', type: 'user' } });
      expect(collaborators.value).toHaveLength(1);

      // Lock a block for that collaborator
      const blockLockedHandler = mockChannel._handlers['client-block_locked'];
      blockLockedHandler({ blockId: 'block-1', userId: 'user-2' });
      expect(lockedBlocks.value.has('block-1')).toBe(true);

      // Remove the collaborator
      const memberRemovedHandler = mockChannel._handlers['pusher:member_removed'];
      memberRemovedHandler({ id: 'user-2', info: { id: 'user-2', name: 'Alice', type: 'user' } });

      expect(collaborators.value).toHaveLength(0);
      expect(lockedBlocks.value.has('block-1')).toBe(false);
      expect(onCollaboratorLeft).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-2', name: 'Alice' }),
      );
    });

    it('does not call onCollaboratorLeft for unknown member', async () => {
      const channel = ref<PresenceChannel | null>(null);
      const mockChannel = createMockChannel();
      const onCollaboratorLeft = vi.fn();

      useCollaboration({
        authManager: createMockAuthManager(),
        editor: createMockEditor(),
        channel,
        onCollaboratorLeft,
      });

      channel.value = mockChannel;
      await nextTick();

      const memberRemovedHandler = mockChannel._handlers['pusher:member_removed'];
      memberRemovedHandler({ id: 'unknown-user', info: { id: 'unknown-user', name: 'Ghost', type: 'user' } });

      expect(onCollaboratorLeft).not.toHaveBeenCalled();
    });

    describe('handleBlockLocked', () => {
      it('updates collaborator selectedBlockId and adds to lockedBlocks', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const onBlockLocked = vi.fn();

        const { collaborators, lockedBlocks } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
          onBlockLocked,
        });

        channel.value = mockChannel;
        await nextTick();

        // Add collaborator
        mockChannel._handlers['pusher:member_added']({
          id: 'user-2',
          info: { id: 'user-2', name: 'Alice', type: 'user' },
        });

        // Lock a block
        mockChannel._handlers['client-block_locked']({ blockId: 'block-1', userId: 'user-2' });

        expect(collaborators.value[0].selectedBlockId).toBe('block-1');
        expect(lockedBlocks.value.get('block-1')).toEqual(
          expect.objectContaining({ id: 'user-2', selectedBlockId: 'block-1' }),
        );
        expect(onBlockLocked).toHaveBeenCalledWith({
          blockId: 'block-1',
          collaborator: expect.objectContaining({ id: 'user-2', selectedBlockId: 'block-1' }),
        });
      });

      it('clears previous lock from same user when locking new block', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();

        const { lockedBlocks } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        mockChannel._handlers['pusher:member_added']({
          id: 'user-2',
          info: { id: 'user-2', name: 'Alice', type: 'user' },
        });

        mockChannel._handlers['client-block_locked']({ blockId: 'block-1', userId: 'user-2' });
        expect(lockedBlocks.value.has('block-1')).toBe(true);

        mockChannel._handlers['client-block_locked']({ blockId: 'block-2', userId: 'user-2' });
        expect(lockedBlocks.value.has('block-1')).toBe(false);
        expect(lockedBlocks.value.has('block-2')).toBe(true);
        expect(lockedBlocks.value.get('block-2')!.id).toBe('user-2');
      });

      it('deselects editor block when collaborator locks the currently selected block', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();
        editor.state.selectedBlockId = 'block-1';

        useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        mockChannel._handlers['pusher:member_added']({
          id: 'user-2',
          info: { id: 'user-2', name: 'Alice', type: 'user' },
        });

        mockChannel._handlers['client-block_locked']({ blockId: 'block-1', userId: 'user-2' });

        expect(editor.selectBlock).toHaveBeenCalledWith(null);
      });

      it('does not deselect editor block when collaborator locks a different block', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();
        editor.state.selectedBlockId = 'block-99';

        useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        mockChannel._handlers['pusher:member_added']({
          id: 'user-2',
          info: { id: 'user-2', name: 'Alice', type: 'user' },
        });

        mockChannel._handlers['client-block_locked']({ blockId: 'block-1', userId: 'user-2' });

        expect(editor.selectBlock).not.toHaveBeenCalled();
      });

      it('ignores block_locked from unknown user', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const onBlockLocked = vi.fn();

        const { lockedBlocks } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
          onBlockLocked,
        });

        channel.value = mockChannel;
        await nextTick();

        mockChannel._handlers['client-block_locked']({ blockId: 'block-1', userId: 'unknown' });

        expect(lockedBlocks.value.size).toBe(0);
        expect(onBlockLocked).not.toHaveBeenCalled();
      });
    });

    describe('handleBlockUnlocked', () => {
      it('removes block from lockedBlocks and resets collaborator selectedBlockId', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const onBlockUnlocked = vi.fn();

        const { collaborators, lockedBlocks } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
          onBlockUnlocked,
        });

        channel.value = mockChannel;
        await nextTick();

        mockChannel._handlers['pusher:member_added']({
          id: 'user-2',
          info: { id: 'user-2', name: 'Alice', type: 'user' },
        });

        mockChannel._handlers['client-block_locked']({ blockId: 'block-1', userId: 'user-2' });
        expect(lockedBlocks.value.has('block-1')).toBe(true);

        mockChannel._handlers['client-block_unlocked']({ blockId: 'block-1' });

        expect(lockedBlocks.value.has('block-1')).toBe(false);
        expect(collaborators.value[0].selectedBlockId).toBeNull();
        expect(onBlockUnlocked).toHaveBeenCalledWith({
          blockId: 'block-1',
          collaborator: expect.objectContaining({ id: 'user-2' }),
        });
      });

      it('does not call onBlockUnlocked when block was not locked', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const onBlockUnlocked = vi.fn();

        useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
          onBlockUnlocked,
        });

        channel.value = mockChannel;
        await nextTick();

        mockChannel._handlers['client-block_unlocked']({ blockId: 'nonexistent' });

        expect(onBlockUnlocked).not.toHaveBeenCalled();
      });
    });

    describe('handleRemoteOperation', () => {
      beforeEach(() => {
        vi.mocked(handleOperation).mockClear();
      });

      it('calls handleOperation for client-operation events', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();

        useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        const payload = { operation: 'update_block' as const, block_id: 'b1', properties: { content: 'hi' } };
        mockChannel._handlers['client-operation'](payload);

        expect(handleOperation).toHaveBeenCalledWith(editor, payload);
      });

      it('calls handleOperation for mcp-operation events', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();

        useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        const payload = { operation: 'add_block' as const, block_type: 'text', properties: {} };
        mockChannel._handlers['mcp-operation'](payload);

        expect(handleOperation).toHaveBeenCalledWith(editor, payload);
      });

      it('sets isProcessingRemoteOperation during execution', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();

        const { _isProcessingRemoteOperation } = useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        let flagDuringExecution = false;
        vi.mocked(handleOperation).mockImplementation(() => {
          flagDuringExecution = _isProcessingRemoteOperation();
        });

        mockChannel._handlers['client-operation']({
          operation: 'update_block' as const,
          block_id: 'b1',
          properties: {},
        });

        expect(flagDuringExecution).toBe(true);
        expect(_isProcessingRemoteOperation()).toBe(false);
      });

      it('resets isProcessingRemoteOperation even when handleOperation throws', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();

        const { _isProcessingRemoteOperation } = useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        vi.mocked(handleOperation).mockImplementation(() => {
          throw new Error('boom');
        });

        expect(() => {
          mockChannel._handlers['client-operation']({
            operation: 'update_block' as const,
            block_id: 'b1',
            properties: {},
          });
        }).toThrow('boom');

        expect(_isProcessingRemoteOperation()).toBe(false);
      });
    });

    describe('broadcastOperation suppression during remote operation', () => {
      beforeEach(() => {
        vi.mocked(handleOperation).mockClear();
      });

      it('does not broadcast when processing a remote operation', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();

        const { _broadcastOperation } = useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        const triggerCallsBefore = vi.mocked(mockChannel.trigger).mock.calls.length;

        vi.mocked(handleOperation).mockImplementation(() => {
          _broadcastOperation({ operation: 'update_block' as const, block_id: 'b1', properties: {} });
        });

        mockChannel._handlers['client-operation']({
          operation: 'update_block' as const,
          block_id: 'b1',
          properties: {},
        });

        // trigger should not have been called for the broadcast inside the remote handler
        expect(vi.mocked(mockChannel.trigger).mock.calls.length).toBe(triggerCallsBefore);
      });
    });

    describe('selectedBlockId watcher broadcasts lock/unlock', () => {
      it('broadcasts block_locked when selectedBlockId changes to a new block', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const state = reactive({ selectedBlockId: null as string | null, content: { blocks: [], settings: {} } });
        const editor = {
          state,
          addBlock: vi.fn(),
          updateBlock: vi.fn(),
          removeBlock: vi.fn(),
          moveBlock: vi.fn(),
          updateSettings: vi.fn(),
          setContent: vi.fn(),
          selectBlock: vi.fn(),
        } as unknown as UseEditorReturn;

        useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        state.selectedBlockId = 'block-A';
        await nextTick();

        expect(mockChannel.trigger).toHaveBeenCalledWith('client-block_locked', {
          blockId: 'block-A',
          userId: 'my-user',
        });
      });

      it('broadcasts block_unlocked for old block and block_locked for new block', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const state = reactive({ selectedBlockId: 'block-A' as string | null, content: { blocks: [], settings: {} } });
        const editor = {
          state,
          addBlock: vi.fn(),
          updateBlock: vi.fn(),
          removeBlock: vi.fn(),
          moveBlock: vi.fn(),
          updateSettings: vi.fn(),
          setContent: vi.fn(),
          selectBlock: vi.fn(),
        } as unknown as UseEditorReturn;

        useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        // Clear calls from channel setup
        vi.mocked(mockChannel.trigger).mockClear();

        state.selectedBlockId = 'block-B';
        await nextTick();

        expect(mockChannel.trigger).toHaveBeenCalledWith('client-block_unlocked', { blockId: 'block-A' });
        expect(mockChannel.trigger).toHaveBeenCalledWith('client-block_locked', {
          blockId: 'block-B',
          userId: 'my-user',
        });
      });

      it('broadcasts only block_unlocked when selectedBlockId changes to null', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const state = reactive({ selectedBlockId: 'block-A' as string | null, content: { blocks: [], settings: {} } });
        const editor = {
          state,
          addBlock: vi.fn(),
          updateBlock: vi.fn(),
          removeBlock: vi.fn(),
          moveBlock: vi.fn(),
          updateSettings: vi.fn(),
          setContent: vi.fn(),
          selectBlock: vi.fn(),
        } as unknown as UseEditorReturn;

        useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        vi.mocked(mockChannel.trigger).mockClear();

        state.selectedBlockId = null;
        await nextTick();

        expect(mockChannel.trigger).toHaveBeenCalledWith('client-block_unlocked', { blockId: 'block-A' });
        expect(mockChannel.trigger).not.toHaveBeenCalledWith(
          'client-block_locked',
          expect.anything(),
        );
      });

      it('does not broadcast when broadcastOperation is called during remote processing', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();
        const editor = createMockEditor();

        const { _broadcastOperation } = useCollaboration({
          authManager: createMockAuthManager(),
          editor,
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        vi.mocked(mockChannel.trigger).mockClear();

        // During a remote operation, broadcastOperation should be suppressed
        vi.mocked(handleOperation).mockImplementation(() => {
          _broadcastOperation({ operation: 'update_block' as const, block_id: 'b1', properties: {} });
        });

        mockChannel._handlers['client-operation']({
          operation: 'update_block' as const,
          block_id: 'x',
          properties: {},
        });

        // No client-operation trigger should have been emitted
        const operationCalls = vi.mocked(mockChannel.trigger).mock.calls.filter(
          (call) => call[0] === 'client-operation',
        );
        expect(operationCalls).toHaveLength(0);
      });
    });

    describe('members.each on channel set', () => {
      it('adds existing members when channel is set', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();

        // Mock members.each to invoke callback with existing members
        vi.mocked(mockChannel.members.each).mockImplementation((callback: any) => {
          callback({ id: 'user-2', info: { id: 'user-2', name: 'Alice', type: 'user' } });
          callback({ id: 'user-3', info: { id: 'user-3', name: 'Bob', type: 'user' } });
        });

        const { collaborators } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        expect(collaborators.value).toHaveLength(2);
        expect(collaborators.value[0].id).toBe('user-2');
        expect(collaborators.value[1].id).toBe('user-3');
      });

      it('excludes self from existing members', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();

        vi.mocked(mockChannel.members.each).mockImplementation((callback: any) => {
          callback({ id: 'my-user', info: { id: 'my-user', name: 'Me', type: 'user' } });
          callback({ id: 'user-2', info: { id: 'user-2', name: 'Alice', type: 'user' } });
        });

        const { collaborators } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        expect(collaborators.value).toHaveLength(1);
        expect(collaborators.value[0].id).toBe('user-2');
      });
    });

    describe('color assignment', () => {
      it('cycles through colors and wraps around after 10 collaborators', async () => {
        const channel = ref<PresenceChannel | null>(null);
        const mockChannel = createMockChannel();

        const { collaborators } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
        });

        channel.value = mockChannel;
        await nextTick();

        const memberAddedHandler = mockChannel._handlers['pusher:member_added'];
        for (let i = 0; i < 12; i++) {
          memberAddedHandler({
            id: `user-${i}`,
            info: { id: `user-${i}`, name: `User ${i}`, type: 'user' },
          });
        }

        expect(collaborators.value).toHaveLength(12);
        // First user gets color 0, 11th user (index 10) wraps to color 0
        expect(collaborators.value[0].color).toBe('#3b82f6');
        expect(collaborators.value[9].color).toBe('#14b8a6');
        // 11th collaborator wraps around to first color
        expect(collaborators.value[10].color).toBe('#3b82f6');
        expect(collaborators.value[11].color).toBe('#ef4444');
      });
    });

    describe('channel change to new channel', () => {
      it('unbinds old channel and binds new channel', async () => {
        const oldChannel = createMockChannel();
        const newChannel = createMockChannel();
        const channel = ref<PresenceChannel | null>(null);

        useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
        });

        channel.value = oldChannel;
        await nextTick();
        expect(oldChannel.bind).toHaveBeenCalled();

        channel.value = newChannel;
        await nextTick();

        // Old channel should be unbound
        expect(oldChannel.unbind).toHaveBeenCalledWith('pusher:member_added');
        expect(oldChannel.unbind).toHaveBeenCalledWith('pusher:member_removed');
        expect(oldChannel.unbind).toHaveBeenCalledWith('client-block_locked');
        expect(oldChannel.unbind).toHaveBeenCalledWith('client-block_unlocked');
        expect(oldChannel.unbind).toHaveBeenCalledWith('client-operation');
        expect(oldChannel.unbind).toHaveBeenCalledWith('mcp-operation');

        // New channel should be bound
        expect(newChannel.bind).toHaveBeenCalledWith('pusher:member_added', expect.any(Function));
        expect(newChannel.bind).toHaveBeenCalledWith('pusher:member_removed', expect.any(Function));
        expect(newChannel.bind).toHaveBeenCalledWith('client-block_locked', expect.any(Function));
        expect(newChannel.bind).toHaveBeenCalledWith('client-block_unlocked', expect.any(Function));
        expect(newChannel.bind).toHaveBeenCalledWith('client-operation', expect.any(Function));
        expect(newChannel.bind).toHaveBeenCalledWith('mcp-operation', expect.any(Function));
      });

      it('clears collaborators from old channel when switching', async () => {
        const oldChannel = createMockChannel();
        const newChannel = createMockChannel();
        const channel = ref<PresenceChannel | null>(null);

        const { collaborators } = useCollaboration({
          authManager: createMockAuthManager(),
          editor: createMockEditor(),
          channel,
        });

        channel.value = oldChannel;
        await nextTick();

        // Add a collaborator on old channel
        oldChannel._handlers['pusher:member_added']({
          id: 'user-2',
          info: { id: 'user-2', name: 'Alice', type: 'user' },
        });
        expect(collaborators.value).toHaveLength(1);

        // Switch to null first (clears state), then to new channel
        channel.value = null;
        await nextTick();
        expect(collaborators.value).toHaveLength(0);

        channel.value = newChannel;
        await nextTick();
        expect(collaborators.value).toHaveLength(0);
      });
    });
  });
});
