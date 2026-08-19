import { describe, expect, it, vi } from 'vitest';
import type { AuthManager } from '../../src/cloud/auth';

/**
 * `pusher-js` is unresolvable for this whole file — that is its entire purpose.
 *
 * It lives apart from `websocket-client.test.ts`, which mocks the package as
 * *working*. Holding both states in one file needs `vi.resetModules()` plus a
 * re-mock in `afterEach`, and that machinery is order- and timing-sensitive: it
 * failed intermittently under the root `pnpm run test`, where every package runs
 * in parallel, and never under `--filter` or in isolation. A hoisted `vi.mock`
 * per file needs no reset and cannot interleave.
 */
vi.mock('pusher-js', () => {
  throw new Error("Cannot find module 'pusher-js'");
});

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

describe('WebSocketClient without the pusher-js optional peer', () => {
  /** Connect against a module graph where `import("pusher-js")` fails. */
  async function connectWithoutPusher(): Promise<Error> {
    const { WebSocketClient } = await import('../../src/cloud/websocket-client');

    const client = new WebSocketClient({
      authManager: createMockAuthManager(),
      config: { host: 'ws.example.com', port: 6001, appKey: 'test-key' },
    });

    return client.connect().then(
      () => {
        throw new Error('connect() resolved, but it should have thrown');
      },
      (error: Error) => error,
    );
  }

  it('throws an error naming the missing package', async () => {
    const error = await connectWithoutPusher();

    expect(error.message).toBe(
      "[Templatical] Cloud features require the optional peer dependency 'pusher-js'. Please install it.",
    );
  });

  it('does not name a specific package manager', async () => {
    const error = await connectWithoutPusher();

    // Pin the message we control *before* pattern-matching it. If the mock ever
    // fails to apply, `connect()` surfaces a real resolution error whose path
    // contains `node_modules/.pnpm/…` — and `\bpnpm\b` matches that, so the
    // regex below would fail for a reason that has nothing to do with our copy.
    // This guard turns that into a legible failure instead of a baffling one.
    expect(error.message).toContain(
      "optional peer dependency 'pusher-js'",
    );

    // The install command depends on the consumer's setup, so the message names
    // the package and leaves the command to them.
    expect(error.message).not.toMatch(/\b(npm|pnpm|yarn|bun)\b/i);
  });
});
