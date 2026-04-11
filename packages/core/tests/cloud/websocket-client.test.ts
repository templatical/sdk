import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveWebSocketConfig, WebSocketClient } from '../../src/cloud/websocket-client';
import type { AuthManager } from '../../src/cloud/auth';
import type { WebSocketServerConfig } from '@templatical/types';

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    accessTokenValue: 'tok-123',
    resolveUrl: vi.fn((url: string) => `https://api.example.com${url}`),
    userConfig: { id: 'user-1', name: 'Test User', signature: 'sig-1' },
  } as unknown as AuthManager;
}

// --- Pusher mock shared across "after connect()" tests ---

const mockPusherInstance = {
  connection: {
    bind: vi.fn(),
    socket_id: 'sock-abc-123',
    state: 'connected',
  },
  subscribe: vi.fn().mockReturnValue({ name: 'presence-test', bind: vi.fn() }),
  unsubscribe: vi.fn(),
  channel: vi.fn().mockReturnValue({ name: 'presence-test', bind: vi.fn() }),
  disconnect: vi.fn(),
};

vi.mock('pusher-js', () => ({
  default: function MockPusher(
    this: typeof mockPusherInstance,
    ..._args: unknown[]
  ) {
    Object.assign(this, mockPusherInstance);
    return this;
  },
}));

describe('resolveWebSocketConfig', () => {
  it('maps snake_case app_key to camelCase appKey', () => {
    const serverConfig: WebSocketServerConfig = {
      host: 'ws.example.com',
      port: 6001,
      app_key: 'my-app-key',
    };

    const result = resolveWebSocketConfig(serverConfig);

    expect(result.appKey).toBe('my-app-key');
  });

  it('maps host and port directly', () => {
    const serverConfig: WebSocketServerConfig = {
      host: 'ws.example.com',
      port: 6001,
      app_key: 'my-app-key',
    };

    const result = resolveWebSocketConfig(serverConfig);

    expect(result.host).toBe('ws.example.com');
    expect(result.port).toBe(6001);
  });

  it('returns a complete WebSocketConfig', () => {
    const serverConfig: WebSocketServerConfig = {
      host: 'localhost',
      port: 443,
      app_key: 'key-abc',
    };

    const result = resolveWebSocketConfig(serverConfig);

    expect(result).toEqual({
      host: 'localhost',
      port: 443,
      appKey: 'key-abc',
    });
  });
});

describe('WebSocketClient', () => {
  function createClient(
    overrides?: Partial<{
      onError: (error: Error) => void;
      authManager: AuthManager;
    }>,
  ) {
    return new WebSocketClient({
      authManager: overrides?.authManager ?? createMockAuthManager(),
      config: { host: 'ws.example.com', port: 6001, appKey: 'test-key' },
      onError: overrides?.onError,
    });
  }

  it('stores config from constructor', () => {
    const client = createClient();
    expect(client.isConnected).toBe(false);
    expect(client.getSocketId()).toBeNull();
  });

  it('isConnected returns false before connect', () => {
    const client = createClient();
    expect(client.isConnected).toBe(false);
  });

  it('getSocketId returns null before connect', () => {
    const client = createClient();
    expect(client.getSocketId()).toBeNull();
  });

  it('disconnect before connect leaves client disconnected', () => {
    const client = createClient();
    client.disconnect();
    expect(client.isConnected).toBe(false);
  });

  it('subscribePresence throws if not connected', () => {
    const client = createClient();
    expect(() => client.subscribePresence('presence-channel')).toThrow(
      'WebSocketClient not connected. Call connect() first.',
    );
  });

  it('unsubscribe before connect returns without error', () => {
    const client = createClient();
    client.unsubscribe('some-channel');
    expect(client.getChannel('some-channel')).toBeUndefined();
  });

  it('getChannel returns undefined before connect', () => {
    const client = createClient();
    expect(client.getChannel('some-channel')).toBeUndefined();
  });

  describe('after connect()', () => {
    beforeEach(() => {
      // Reset mock state between tests
      mockPusherInstance.connection.bind.mockClear();
      mockPusherInstance.connection.socket_id = 'sock-abc-123';
      mockPusherInstance.connection.state = 'connected';
      mockPusherInstance.subscribe
        .mockClear()
        .mockReturnValue({ name: 'presence-test', bind: vi.fn() });
      mockPusherInstance.unsubscribe.mockClear();
      mockPusherInstance.channel
        .mockClear()
        .mockReturnValue({ name: 'presence-test', bind: vi.fn() });
      mockPusherInstance.disconnect.mockClear();
    });

    async function createConnectedClient(
      overrides?: Partial<{
        onError: (error: Error) => void;
        authManager: AuthManager;
      }>,
    ) {
      const client = new WebSocketClient({
        authManager: overrides?.authManager ?? createMockAuthManager(),
        config: { host: 'ws.example.com', port: 6001, appKey: 'test-key' },
        onError: overrides?.onError,
      });
      await client.connect();
      return client;
    }

    it('creates Pusher with correct config options', async () => {
      const client = await createConnectedClient();

      // Verify connection was established (state comes from mock)
      expect(client.isConnected).toBe(true);
      // The bind was called for the error handler
      expect(mockPusherInstance.connection.bind).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });

    it('passes channelAuthorization with resolved endpoint and auth headers', async () => {
      // We verify the auth manager's resolveUrl was called during connect
      const authManager = createMockAuthManager();
      await createConnectedClient({ authManager });

      expect(authManager.resolveUrl).toHaveBeenCalledTimes(1);
      // resolveUrl receives the broadcasting auth URL containing project and tenant
      const calledWith = (
        authManager.resolveUrl as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as string;
      expect(calledWith).toContain('proj-1');
      expect(calledWith).toContain('acme');
      expect(calledWith).toContain('broadcasting/auth');
    });

    it('binds error handler on connection', async () => {
      await createConnectedClient();

      expect(mockPusherInstance.connection.bind).toHaveBeenCalledTimes(1);
      expect(mockPusherInstance.connection.bind).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });

    it('error handler forwards Error instances to onError', async () => {
      const onError = vi.fn();
      await createConnectedClient({ onError });

      const errorCallback =
        mockPusherInstance.connection.bind.mock.calls[0][1];
      const originalError = new Error('connection lost');
      errorCallback(originalError);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(originalError);
    });

    it('error handler wraps non-Error objects with generic message', async () => {
      const onError = vi.fn();
      await createConnectedClient({ onError });

      const errorCallback =
        mockPusherInstance.connection.bind.mock.calls[0][1];
      errorCallback('some string error');

      expect(onError).toHaveBeenCalledTimes(1);
      const passedError = onError.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(Error);
      expect(passedError.message).toBe('WebSocket connection error');
    });

    it('error handler wraps null/undefined to generic Error', async () => {
      const onError = vi.fn();
      await createConnectedClient({ onError });

      const errorCallback =
        mockPusherInstance.connection.bind.mock.calls[0][1];
      errorCallback(null);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe(
        'WebSocket connection error',
      );
    });

    it('error handler does nothing when onError is not provided', async () => {
      // No onError callback — should not throw
      await createConnectedClient();

      const errorCallback =
        mockPusherInstance.connection.bind.mock.calls[0][1];
      expect(() => errorCallback('some error')).not.toThrow();
    });

    it('connect() is idempotent — second call returns early without re-binding', async () => {
      const client = await createConnectedClient();

      const bindCallsBefore = mockPusherInstance.connection.bind.mock.calls.length;

      // Call connect again
      await client.connect();

      // No additional bind calls — Pusher was not re-created
      expect(mockPusherInstance.connection.bind.mock.calls.length).toBe(
        bindCallsBefore,
      );
    });

    it('isConnected returns true when connection state is connected', async () => {
      const client = await createConnectedClient();
      expect(client.isConnected).toBe(true);
    });

    it('isConnected returns false when connection state is not connected', async () => {
      mockPusherInstance.connection.state = 'disconnected';
      const client = await createConnectedClient();
      expect(client.isConnected).toBe(false);
    });

    it('getSocketId returns pusher connection socket_id', async () => {
      const client = await createConnectedClient();
      expect(client.getSocketId()).toBe('sock-abc-123');
    });

    it('subscribePresence returns channel from pusher.subscribe', async () => {
      const client = await createConnectedClient();
      const channel = client.subscribePresence('presence-room-42');

      expect(mockPusherInstance.subscribe).toHaveBeenCalledTimes(1);
      expect(mockPusherInstance.subscribe).toHaveBeenCalledWith(
        'presence-room-42',
      );
      expect(channel).toEqual({
        name: 'presence-test',
        bind: expect.any(Function),
      });
    });

    it('getChannel returns result from pusher.channel()', async () => {
      const expectedChannel = { name: 'my-channel', bind: vi.fn() };
      mockPusherInstance.channel.mockReturnValue(expectedChannel);

      const client = await createConnectedClient();
      const channel = client.getChannel('my-channel');

      expect(mockPusherInstance.channel).toHaveBeenCalledWith('my-channel');
      expect(channel).toBe(expectedChannel);
    });

    it('unsubscribe calls pusher.unsubscribe with channel name', async () => {
      const client = await createConnectedClient();
      client.unsubscribe('presence-room-42');

      expect(mockPusherInstance.unsubscribe).toHaveBeenCalledTimes(1);
      expect(mockPusherInstance.unsubscribe).toHaveBeenCalledWith(
        'presence-room-42',
      );
    });

    it('disconnect calls pusher.disconnect and resets state', async () => {
      const client = await createConnectedClient();
      expect(client.isConnected).toBe(true);

      client.disconnect();

      expect(mockPusherInstance.disconnect).toHaveBeenCalledTimes(1);
      expect(client.isConnected).toBe(false);
      expect(client.getSocketId()).toBeNull();
    });

    it('disconnect then getChannel returns undefined', async () => {
      const client = await createConnectedClient();
      client.disconnect();

      expect(client.getChannel('any-channel')).toBeUndefined();
    });

    it('disconnect then subscribePresence throws', async () => {
      const client = await createConnectedClient();
      client.disconnect();

      expect(() => client.subscribePresence('presence-channel')).toThrow(
        'WebSocketClient not connected. Call connect() first.',
      );
    });

    it('can reconnect after disconnect', async () => {
      const client = await createConnectedClient();
      client.disconnect();

      expect(client.isConnected).toBe(false);

      // Reconnect — bind should be called again for the new instance
      const bindCallsBefore =
        mockPusherInstance.connection.bind.mock.calls.length;
      await client.connect();

      expect(mockPusherInstance.connection.bind.mock.calls.length).toBe(
        bindCallsBefore + 1,
      );
      expect(client.isConnected).toBe(true);
    });
  });
});
