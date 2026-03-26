import { describe, expect, it, vi } from 'vitest';
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
  function createClient() {
    return new WebSocketClient({
      authManager: createMockAuthManager(),
      config: { host: 'ws.example.com', port: 6001, appKey: 'test-key' },
    });
  }

  it('stores config from constructor', () => {
    const client = createClient();
    expect(client).toBeDefined();
  });

  it('isConnected returns false before connect', () => {
    const client = createClient();
    expect(client.isConnected).toBe(false);
  });

  it('getSocketId returns null before connect', () => {
    const client = createClient();
    expect(client.getSocketId()).toBeNull();
  });

  it('disconnect is safe to call before connect', () => {
    const client = createClient();
    expect(() => client.disconnect()).not.toThrow();
  });

  it('subscribePresence throws if not connected', () => {
    const client = createClient();
    expect(() => client.subscribePresence('presence-channel')).toThrow(
      'WebSocketClient not connected. Call connect() first.',
    );
  });

  it('unsubscribe is safe to call before connect', () => {
    const client = createClient();
    expect(() => client.unsubscribe('some-channel')).not.toThrow();
  });

  it('getChannel returns undefined before connect', () => {
    const client = createClient();
    expect(client.getChannel('some-channel')).toBeUndefined();
  });
});
