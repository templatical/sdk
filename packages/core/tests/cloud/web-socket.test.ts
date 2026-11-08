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
    vi.mocked(WebSocketClient.prototype.subscribePresence).mockClear();
    vi.mocked(WebSocketClient.prototype.unsubscribe).mockClear();
    vi.mocked(WebSocketClient.prototype.disconnect).mockClear();
    vi.mocked(WebSocketClient.prototype.connect).mockClear();
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
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('does not reconnect if already connected', async () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });

      await ws.connect('tmpl-1', mockConfig);
      const connectCallsBefore = vi.mocked(WebSocketClient.prototype.connect).mock.calls.length;

      await ws.connect('tmpl-2', mockConfig);

      expect(vi.mocked(WebSocketClient.prototype.connect).mock.calls.length).toBe(connectCallsBefore);
    });

    it('switches presence channels without reconnecting the client', async () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });
      const channels = [
        { bind: vi.fn(), unbind: vi.fn(), trigger: vi.fn() },
        { bind: vi.fn(), unbind: vi.fn(), trigger: vi.fn() },
      ];
      vi.mocked(WebSocketClient.prototype.subscribePresence)
        .mockReturnValueOnce(channels[0] as any)
        .mockReturnValueOnce(channels[1] as any);

      await ws.connect('tmpl-1', mockConfig);
      const succeeded = channels[0].bind.mock.calls.find((call: any[]) => call[0] === 'pusher:subscription_succeeded')![1];
      succeeded();
      expect(ws.isConnected.value).toBe(true);

      await ws.connect('tmpl-2', mockConfig);
      expect(WebSocketClient.prototype.unsubscribe).toHaveBeenCalledWith('presence-template.tmpl-1');
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledWith('presence-template.tmpl-2');
      expect(WebSocketClient.prototype.connect).toHaveBeenCalledTimes(1);
      expect(ws.channel.value).toBeNull();
      expect(ws.isConnected.value).toBe(false);

      succeeded();
      expect(ws.channel.value).toBeNull();
      expect(ws.isConnected.value).toBe(false);

      const nextSucceeded = channels[1].bind.mock.calls.find((call: any[]) => call[0] === 'pusher:subscription_succeeded')![1];
      nextSucceeded();
      expect(ws.channel.value?.bind).toBe(channels[1].bind);
      expect(ws.isConnected.value).toBe(true);
    });

    it('keeps the current channel when it is requested again during a pending switch', async () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });
      await ws.connect('tmpl-1', mockConfig);

      const toSecond = ws.connect('tmpl-2', mockConfig);
      const backToFirst = ws.connect('tmpl-1', mockConfig);
      await Promise.all([toSecond, backToFirst]);

      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledTimes(1);
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledWith('presence-template.tmpl-1');
      expect(WebSocketClient.prototype.unsubscribe).not.toHaveBeenCalled();
    });

    it('subscribes only the last template requested while the socket opens', async () => {
      let release!: () => void;
      vi.mocked(WebSocketClient.prototype.connect).mockImplementation(
        () => new Promise<void>((resolve) => { release = resolve; }),
      );
      const ws = useWebSocket({ authManager: createMockAuthManager() });
      const first = ws.connect('tmpl-1', mockConfig);
      const second = ws.connect('tmpl-2', mockConfig);

      release();
      await Promise.all([first, second]);
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledTimes(1);
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledWith('presence-template.tmpl-2');
      expect(WebSocketClient.prototype.unsubscribe).not.toHaveBeenCalled();
    });

    it('closes a socket that finishes opening after disconnect', async () => {
      let release!: () => void;
      vi.mocked(WebSocketClient.prototype.connect).mockImplementation(
        () => new Promise<void>((resolve) => { release = resolve; }),
      );
      const ws = useWebSocket({ authManager: createMockAuthManager() });
      const pending = ws.connect('tmpl-1', mockConfig);

      ws.disconnect();
      expect(WebSocketClient.prototype.disconnect).toHaveBeenCalledTimes(1);

      release();
      await pending;
      expect(WebSocketClient.prototype.disconnect).toHaveBeenCalledTimes(2);
      expect(WebSocketClient.prototype.subscribePresence).not.toHaveBeenCalled();
      expect(ws.channel.value).toBeNull();
      expect(ws.isConnected.value).toBe(false);
    });

    it('opens a new socket after a failed connection attempt', async () => {
      vi.mocked(WebSocketClient.prototype.connect)
        .mockRejectedValueOnce(new Error('install pusher-js'))
        .mockResolvedValueOnce(undefined);
      const ws = useWebSocket({ authManager: createMockAuthManager() });

      await expect(ws.connect('tmpl-1', mockConfig)).rejects.toThrow('install pusher-js');
      expect(WebSocketClient.prototype.subscribePresence).not.toHaveBeenCalled();

      await ws.connect('tmpl-1', mockConfig);
      expect(WebSocketClient).toHaveBeenCalledTimes(2);
      expect(WebSocketClient.prototype.connect).toHaveBeenCalledTimes(2);
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledTimes(1);
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledWith('presence-template.tmpl-1');
    });

    it('subscribes only once when connecting the same template twice', async () => {
      const ws = useWebSocket({ authManager: createMockAuthManager() });
      await ws.connect('tmpl-1', mockConfig);
      await ws.connect('tmpl-1', mockConfig);

      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledTimes(1);
      expect(WebSocketClient.prototype.unsubscribe).not.toHaveBeenCalled();
      expect(WebSocketClient.prototype.connect).toHaveBeenCalledTimes(1);
    });

    it('subscribes only once when the same template is requested while the socket opens', async () => {
      let release!: () => void;
      vi.mocked(WebSocketClient.prototype.connect).mockImplementation(
        () => new Promise<void>((resolve) => { release = resolve; }),
      );
      const ws = useWebSocket({ authManager: createMockAuthManager() });
      const first = ws.connect('tmpl-1', mockConfig);
      const second = ws.connect('tmpl-1', mockConfig);

      release();
      await Promise.all([first, second]);
      expect(WebSocketClient.prototype.connect).toHaveBeenCalledTimes(1);
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledTimes(1);
      expect(WebSocketClient.prototype.subscribePresence).toHaveBeenCalledWith('presence-template.tmpl-1');
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
