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

    it('throws on malformed JSON response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      }));
      const auth = new AuthManager({ url: 'https://example.com/auth' });

      await expect(auth.initialize()).rejects.toThrow();
    });

    it('throws when response missing token field', async () => {
      vi.stubGlobal('fetch', createMockFetch({
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        project_id: 'proj-1',
        tenant: 'acme',
      }));
      const auth = new AuthManager({ url: 'https://example.com/auth' });

      await expect(auth.initialize()).rejects.toThrow('Invalid token response');
    });

    it('throws when response missing expires_at field', async () => {
      vi.stubGlobal('fetch', createMockFetch({
        token: 'test-token',
        project_id: 'proj-1',
        tenant: 'acme',
      }));
      const auth = new AuthManager({ url: 'https://example.com/auth' });

      await expect(auth.initialize()).rejects.toThrow('Invalid token response');
    });

    it('throws when response missing project_id field', async () => {
      vi.stubGlobal('fetch', createMockFetch({
        token: 'test-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        tenant: 'acme',
      }));
      const auth = new AuthManager({ url: 'https://example.com/auth' });

      await expect(auth.initialize()).rejects.toThrow('Invalid token response');
    });

    it('throws when response missing tenant field', async () => {
      vi.stubGlobal('fetch', createMockFetch({
        token: 'test-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        project_id: 'proj-1',
      }));
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

    it('throws when token refresh fails after 401 (cascade failure)', async () => {
      const mockFetch = createMockFetch();
      vi.stubGlobal('fetch', mockFetch);

      const auth = new AuthManager({
        url: 'https://example.com/auth',
        baseUrl: 'https://api.example.com',
      });
      await auth.initialize();

      // API call returns 401, then token refresh fails
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

      await expect(auth.authenticatedFetch('/api/test')).rejects.toThrow(
        'Token refresh failed: 500',
      );
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
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('token expiration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createMockFetch());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes token when expiring within threshold', async () => {
    // First init with token that expires in 30 seconds (within 60s threshold)
    const nearExpiryData = {
      ...VALID_TOKEN_DATA,
      expires_at: Math.floor(Date.now() / 1000) + 30, // 30 seconds from now
    };
    const mockFetch = createMockFetch(nearExpiryData);
    vi.stubGlobal('fetch', mockFetch);

    const auth = new AuthManager({ url: 'https://example.com/auth' });
    await auth.initialize();

    // Reset to return fresh token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        ...VALID_TOKEN_DATA,
        token: 'fresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });

    // authenticatedFetch should trigger refresh because token is expiring soon
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await auth.authenticatedFetch('/api/test');

    // Should have called fetch 3 times: init + refresh + API call
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('reuses valid token without refreshing', async () => {
    const mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);

    const auth = new AuthManager({ url: 'https://example.com/auth' });
    await auth.initialize();

    // API call should reuse token (no refresh needed)
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await auth.authenticatedFetch('/api/test');

    // Only 2 calls: init + API call (no refresh)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not refresh token when it expires well above the threshold', async () => {
    // Token expires in 61 seconds (safely above the 60s threshold)
    const boundaryData = {
      ...VALID_TOKEN_DATA,
      expires_at: Math.floor(Date.now() / 1000) + 61,
    };
    const mockFetch = createMockFetch(boundaryData);
    vi.stubGlobal('fetch', mockFetch);

    const auth = new AuthManager({ url: 'https://example.com/auth' });
    await auth.initialize();

    // API call should reuse token (no refresh needed)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await auth.authenticatedFetch('/api/test');

    // Only 2 calls: init + API call (no refresh)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
