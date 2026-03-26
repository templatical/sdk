import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager, createSdkAuthManager } from '../../src/cloud/auth';

const VALID_TOKEN_DATA = {
  token: 'test-token-123',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  project_id: 'proj-1',
  tenant: 'acme',
  tenant_id: 'tenant-1',
  test_email: {
    allowed_emails: ['user@example.com'],
    signature: 'sig-123',
  },
  user: {
    id: 'user-1',
    name: 'Test User',
    signature: 'user-sig',
  },
};

function createMockFetch(data: unknown = VALID_TOKEN_DATA, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('AuthManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createMockFetch());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and resolveUrl', () => {
    it('resolves relative paths with base URL', () => {
      const auth = new AuthManager({
        url: 'https://example.com/auth',
        baseUrl: 'https://api.example.com',
      });
      expect(auth.resolveUrl('/api/test')).toBe('https://api.example.com/api/test');
    });

    it('passes through absolute URLs', () => {
      const auth = new AuthManager({
        url: 'https://example.com/auth',
        baseUrl: 'https://api.example.com',
      });
      expect(auth.resolveUrl('https://other.com/api')).toBe('https://other.com/api');
    });

    it('uses default base URL when not provided', () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      expect(auth.resolveUrl('/test')).toBe('https://templatical.com/test');
    });

    it('strips trailing slash from base URL', () => {
      const auth = new AuthManager({
        url: 'https://example.com/auth',
        baseUrl: 'https://api.example.com/',
      });
      expect(auth.resolveUrl('/test')).toBe('https://api.example.com/test');
    });

    it('adds leading slash to relative paths', () => {
      const auth = new AuthManager({
        url: 'https://example.com/auth',
        baseUrl: 'https://api.example.com',
      });
      expect(auth.resolveUrl('test')).toBe('https://api.example.com/test');
    });
  });

  describe('getters before initialize', () => {
    it('throws when accessing projectId before initialize', () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      expect(() => auth.projectId).toThrow('Call initialize() first');
    });

    it('throws when accessing tenantId before initialize', () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      expect(() => auth.tenantId).toThrow('Call initialize() first');
    });

    it('throws when accessing tenantSlug before initialize', () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      expect(() => auth.tenantSlug).toThrow('Call initialize() first');
    });

    it('returns null for accessTokenValue before initialize', () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      expect(auth.accessTokenValue).toBeNull();
    });

    it('returns null for testEmailConfig before initialize', () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      expect(auth.testEmailConfig).toBeNull();
    });

    it('returns null for userConfig before initialize', () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      expect(auth.userConfig).toBeNull();
    });
  });

  describe('initialize', () => {
    it('fetches token and populates state', async () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      await auth.initialize();

      expect(auth.accessTokenValue).toBe('test-token-123');
      expect(auth.projectId).toBe('proj-1');
      expect(auth.tenantSlug).toBe('acme');
    });

    it('populates test email config', async () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      await auth.initialize();

      expect(auth.testEmailConfig).toEqual({
        allowedEmails: ['user@example.com'],
        signature: 'sig-123',
      });
    });

    it('populates user config', async () => {
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      await auth.initialize();

      expect(auth.userConfig).toEqual({
        id: 'user-1',
        name: 'Test User',
        signature: 'user-sig',
      });
    });

    it('sets testEmailConfig to null when incomplete', async () => {
      vi.stubGlobal(
        'fetch',
        createMockFetch({ ...VALID_TOKEN_DATA, test_email: null }),
      );
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      await auth.initialize();

      expect(auth.testEmailConfig).toBeNull();
    });

    it('sets userConfig to null when incomplete', async () => {
      vi.stubGlobal(
        'fetch',
        createMockFetch({ ...VALID_TOKEN_DATA, user: { id: 'u1' } }),
      );
      const auth = new AuthManager({ url: 'https://example.com/auth' });
      await auth.initialize();

      expect(auth.userConfig).toBeNull();
    });

    it('throws on invalid token response', async () => {
      vi.stubGlobal('fetch', createMockFetch({ token: null }));
      const auth = new AuthManager({ url: 'https://example.com/auth' });

      await expect(auth.initialize()).rejects.toThrow('Invalid token response');
    });

    it('throws on HTTP error', async () => {
      vi.stubGlobal('fetch', createMockFetch({}, 401));
      const auth = new AuthManager({ url: 'https://example.com/auth' });

      await expect(auth.initialize()).rejects.toThrow('Token refresh failed: 401');
    });

    it('calls onError callback on failure', async () => {
      vi.stubGlobal('fetch', createMockFetch({}, 500));
      const onError = vi.fn();
      const auth = new AuthManager({
        url: 'https://example.com/auth',
        onError,
      });

      await expect(auth.initialize()).rejects.toThrow();
      expect(onError).toHaveBeenCalledOnce();
    });

    it('sends POST with body when configured', async () => {
      const mockFetch = createMockFetch();
      vi.stubGlobal('fetch', mockFetch);

      const auth = new AuthManager({
        url: 'https://example.com/auth',
        requestOptions: {
          method: 'POST',
          body: { client_id: 'abc' },
        },
      });
      await auth.initialize();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/auth',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ client_id: 'abc' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('refreshToken deduplication', () => {
    it('deduplicates concurrent refresh calls', async () => {
      const mockFetch = createMockFetch();
      vi.stubGlobal('fetch', mockFetch);

      const auth = new AuthManager({ url: 'https://example.com/auth' });

      const [token1, token2] = await Promise.all([
        auth.refreshToken(),
        auth.refreshToken(),
      ]);

      expect(token1).toBe('test-token-123');
      expect(token2).toBe('test-token-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('authenticatedFetch', () => {
    it('adds Authorization header', async () => {
      const mockFetch = createMockFetch();
      vi.stubGlobal('fetch', mockFetch);

      const auth = new AuthManager({
        url: 'https://example.com/auth',
        baseUrl: 'https://api.example.com',
      });
      await auth.initialize();

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await auth.authenticatedFetch('/api/test');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.example.com/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        }),
      );
    });

    it('retries with refreshed token on 401', async () => {
      const mockFetch = createMockFetch();
      vi.stubGlobal('fetch', mockFetch);

      const auth = new AuthManager({
        url: 'https://example.com/auth',
        baseUrl: 'https://api.example.com',
      });
      await auth.initialize();

      // First API call returns 401, token refresh succeeds, retry succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ...VALID_TOKEN_DATA,
              token: 'refreshed-token',
            }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await auth.authenticatedFetch('/api/test');

      // Initial auth + API call + refresh + retry = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});

describe('createSdkAuthManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createMockFetch());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates direct mode auth manager', () => {
    const auth = createSdkAuthManager({
      mode: 'direct',
      clientId: 'client-1',
      clientSecret: 'secret-1',
      tenant: 'acme',
    });

    expect(auth).toBeInstanceOf(AuthManager);
  });

  it('creates custom mode auth manager', () => {
    const auth = createSdkAuthManager({
      mode: 'custom',
      url: 'https://custom.com/auth',
    } as any);

    expect(auth).toBeInstanceOf(AuthManager);
  });

  it('passes onError to auth manager', async () => {
    vi.stubGlobal('fetch', createMockFetch({}, 500));
    const onError = vi.fn();

    const auth = createSdkAuthManager(
      {
        mode: 'direct',
        clientId: 'c1',
        clientSecret: 's1',
        tenant: 't1',
      },
      onError,
    );

    await expect(auth.initialize()).rejects.toThrow();
    expect(onError).toHaveBeenCalled();
  });
});
