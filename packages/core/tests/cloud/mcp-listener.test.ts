import { describe, expect, it, vi } from 'vitest';
import { useMcpListener } from '../../src/cloud/mcp-listener';
import type { UseEditorReturn } from '../../src/cloud/editor';
import { ref, nextTick } from 'vue';

function createMockEditor(): UseEditorReturn {
  return {
    addBlock: vi.fn(),
    updateBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    updateSettings: vi.fn(),
    setContent: vi.fn(),
  } as unknown as UseEditorReturn;
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

describe('useMcpListener', () => {
  it('binds mcp-operation on channel set', async () => {
    const channel = ref<any>(null);
    const mockChannel = createMockChannel();

    useMcpListener({
      editor: createMockEditor(),
      channel,
    });

    channel.value = mockChannel;
    await nextTick();

    expect(mockChannel.bind).toHaveBeenCalledWith(
      'mcp-operation',
      expect.any(Function),
    );
  });

  it('unbinds from old channel on change', async () => {
    const channel = ref<any>(null);
    const oldChannel = createMockChannel();
    const newChannel = createMockChannel();

    useMcpListener({
      editor: createMockEditor(),
      channel,
    });

    channel.value = oldChannel;
    await nextTick();

    channel.value = newChannel;
    await nextTick();

    expect(oldChannel.unbind).toHaveBeenCalledWith('mcp-operation');
    expect(newChannel.bind).toHaveBeenCalledWith(
      'mcp-operation',
      expect.any(Function),
    );
  });

  it('dispatches operation to editor via handleOperation', async () => {
    const channel = ref<any>(null);
    const mockChannel = createMockChannel();
    const editor = createMockEditor();

    useMcpListener({ editor, channel });

    channel.value = mockChannel;
    await nextTick();

    const payload = {
      operation: 'update_block',
      data: { block_id: 'b1', updates: { content: 'new' } },
    };
    mockChannel._handlers['mcp-operation'](payload);

    expect(editor.updateBlock).toHaveBeenCalledWith('b1', { content: 'new' });
  });

  it('calls onOperation callback', async () => {
    const channel = ref<any>(null);
    const mockChannel = createMockChannel();
    const onOperation = vi.fn();

    useMcpListener({
      editor: createMockEditor(),
      channel,
      onOperation,
    });

    channel.value = mockChannel;
    await nextTick();

    const payload = {
      operation: 'delete_block',
      data: { block_id: 'b1' },
    };
    mockChannel._handlers['mcp-operation'](payload);

    expect(onOperation).toHaveBeenCalledWith(payload);
  });

  it('does not bind when channel set to null', async () => {
    const channel = ref<any>(null);
    const mockChannel = createMockChannel();

    useMcpListener({
      editor: createMockEditor(),
      channel,
    });

    channel.value = mockChannel;
    await nextTick();

    channel.value = null;
    await nextTick();

    expect(mockChannel.unbind).toHaveBeenCalledWith('mcp-operation');
  });
});
