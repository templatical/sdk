import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWebSocket } from '../../src/cloud/web-socket';
import { WebSocketClient } from '../../src/cloud/websocket-client';
import type { AuthManager } from '../../src/cloud/auth';

vi.mock('../../src/cloud/websocket-client');

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    userConfig: { id: 'u1', name: 'User', signature: 'sig' },
  } as unknown as AuthManager;
}

const mockConfig = { host: 'ws.example.com', port: 443, appKey: 'app-key' };

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.mocked(WebSocketClient).mockClear();
    vi.mocked(WebSocketClient.prototype.connect).mockResolvedValue(undefined);
    vi.mocked(WebSocketClient.prototype.subscribePresence).mockReturnValue({
      bind: vi.fn(),
      unbind: vi.fn(),
      trigger: vi.fn(),
    } as any);
    vi.mocked(WebSocketClient.prototype.getSocketId).mockReturnValue(null);
  });

  it('starts with null channel and disconnected', () => {
    const { channel, isConnected } = useWebSocket({
      authManager: createMockAuthManager(),
    });

    expect(channel.value).toBeNull();
    expect(isConnected.value).toBe(false);
  });

  it('getSocketId returns null before connect', () => {
    const { getSocketId } = useWebSocket({
      authManager: createMockAuthManager(),
    });

    expect(getSocketId()).toBeNull();
  });

  describe('connect', () => {
    it('creates WebSocketClient and subscribes to presence channel', async () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });

      await ws.connect('tmpl-1', mockConfig);

      expect(WebSocketClient.prototype.connect).toHaveBeenCalled();
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledWith(
        'presence-template.tmpl-1',
      );
    });

    it('binds subscription_succeeded and subscription_error', async () => {
      const mockChannel = {
        bind: vi.fn(),
        unbind: vi.fn(),
        trigger: vi.fn(),
      };
      vi.mocked(WebSocketClient.prototype.subscribePresence).mockReturnValue(
        mockChannel as any,
      );

      const ws = useWebSocket({ authManager: createMockAuthManager() });
      await ws.connect('tmpl-1', mockConfig);

      const bindCalls = mockChannel.bind.mock.calls.map((c: any[]) => c[0]);
      expect(bindCalls).toContain('pusher:subscription_succeeded');
      expect(bindCalls).toContain('pusher:subscription_error');
    });

    it('sets isConnected on subscription_succeeded', async () => {
      const mockChannel = {
        bind: vi.fn(),
        unbind: vi.fn(),
        trigger: vi.fn(),
      };
      vi.mocked(WebSocketClient.prototype.subscribePresence).mockReturnValue(
        mockChannel as any,
      );

      const ws = useWebSocket({ authManager: createMockAuthManager() });
      await ws.connect('tmpl-1', mockConfig);

      // Find and call the subscription_succeeded handler
      const succeededCall = mockChannel.bind.mock.calls.find(
        (c: any[]) => c[0] === 'pusher:subscription_succeeded',
      );
      succeededCall[1]();

      expect(ws.isConnected.value).toBe(true);
      expect(ws.channel.value).not.toBeNull();
    });

    it('handles subscription_error', async () => {
      const mockChannel = {
        bind: vi.fn(),
        unbind: vi.fn(),
        trigger: vi.fn(),
      };
      vi.mocked(WebSocketClient.prototype.subscribePresence).mockReturnValue(
        mockChannel as any,
      );

      const onError = vi.fn();
      const ws = useWebSocket({
        authManager: createMockAuthManager(),
        onError,
      });
      await ws.connect('tmpl-1', mockConfig);

      const errorCall = mockChannel.bind.mock.calls.find(
        (c: any[]) => c[0] === 'pusher:subscription_error',
      );
      errorCall[1]('some error');

      expect(ws.isConnected.value).toBe(false);
      expect(ws.channel.value).toBeNull();
      expect(onError).toHaveBeenCalled();
    });

    it('does not reconnect if already connected', async () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });

      await ws.connect('tmpl-1', mockConfig);
      const connectCallsBefore = vi.mocked(WebSocketClient.prototype.connect).mock.calls.length;

      await ws.connect('tmpl-2', mockConfig);

      expect(vi.mocked(WebSocketClient.prototype.connect).mock.calls.length).toBe(connectCallsBefore);
    });
  });

  describe('disconnect', () => {
    it('unsubscribes, disconnects, and resets state', async () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });

      await ws.connect('tmpl-1', mockConfig);
      ws.disconnect();

      expect(WebSocketClient.prototype.unsubscribe).toHaveBeenCalledWith(
        'presence-template.tmpl-1',
      );
      expect(WebSocketClient.prototype.disconnect).toHaveBeenCalled();
      expect(ws.channel.value).toBeNull();
      expect(ws.isConnected.value).toBe(false);
    });

    it('disconnect before connect leaves channel null and isConnected false', () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });

      ws.disconnect();
      expect(ws.channel.value).toBeNull();
      expect(ws.isConnected.value).toBe(false);
    });
  });

  describe('getSocketId', () => {
    it('delegates to WebSocketClient', async () => {
      vi.mocked(WebSocketClient.prototype.getSocketId).mockReturnValue('socket-123');

      const ws = useWebSocket({ authManager: createMockAuthManager() });
      await ws.connect('tmpl-1', mockConfig);

      expect(ws.getSocketId()).toBe('socket-123');
    });
  });
});
