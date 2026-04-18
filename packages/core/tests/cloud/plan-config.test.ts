import { describe, expect, it, vi, beforeEach } from 'vitest';
import { usePlanConfig } from '../../src/cloud/plan-config';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';

vi.mock('../../src/cloud/api');

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

const MOCK_CONFIG = {
  features: {
    comments: true,
    collaboration: true,
    aiChat: false,
    customFonts: true,
  },
};

describe('usePlanConfig', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.fetchConfig).mockResolvedValue(MOCK_CONFIG as any);
  });

  it('starts with null config and not loading', () => {
    const { config, isLoading } = usePlanConfig({
      authManager: createMockAuthManager(),
    });

    expect(config.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  it('fetches config from API', async () => {
    const { config, fetchConfig } = usePlanConfig({
      authManager: createMockAuthManager(),
    });

    await fetchConfig();

    expect(config.value).toEqual(MOCK_CONFIG);
  });

  it('sets isLoading during fetch', async () => {
    const { isLoading, fetchConfig } = usePlanConfig({
      authManager: createMockAuthManager(),
    });

    const promise = fetchConfig();
    expect(isLoading.value).toBe(true);

    await promise;
    expect(isLoading.value).toBe(false);
  });

  it('prevents concurrent fetches', async () => {
    const fetchConfigMock = vi.mocked(ApiClient.prototype.fetchConfig);
    const callCountBefore = fetchConfigMock.mock.calls.length;

    const { fetchConfig } = usePlanConfig({
      authManager: createMockAuthManager(),
    });

    await Promise.all([fetchConfig(), fetchConfig()]);

    // Only one additional call should have been made despite two concurrent invocations
    const newCalls = fetchConfigMock.mock.calls.length - callCountBefore;
    expect(newCalls).toBe(1);
  });

  it('exposes features computed', async () => {
    const { features, fetchConfig } = usePlanConfig({
      authManager: createMockAuthManager(),
    });

    expect(features.value).toBeNull();

    await fetchConfig();

    expect(features.value).toEqual(MOCK_CONFIG.features);
  });

  describe('hasFeature', () => {
    it('returns false when config is null', () => {
      const { hasFeature } = usePlanConfig({
        authManager: createMockAuthManager(),
      });

      expect(hasFeature('comments' as any)).toBe(false);
    });

    it('returns feature value from config', async () => {
      const { hasFeature, fetchConfig } = usePlanConfig({
        authManager: createMockAuthManager(),
      });

      await fetchConfig();

      expect(hasFeature('comments' as any)).toBe(true);
      expect(hasFeature('aiChat' as any)).toBe(false);
    });
  });

  describe('fetchConfig double-call concurrency', () => {
    it('second call returns early while first is loading', async () => {
      const { fetchConfig, isLoading, config } = usePlanConfig({
        authManager: createMockAuthManager(),
      });

      // First call starts and sets isLoading = true
      const first = fetchConfig();
      expect(isLoading.value).toBe(true);

      // Second call should return immediately since isLoading is true
      await fetchConfig();

      // Await the first call
      await first;

      // Config should be populated from the first call
      expect(config.value).toEqual(MOCK_CONFIG);
      expect(isLoading.value).toBe(false);
    });
  });

  describe('error handling', () => {
    it('calls onError on fetch failure', async () => {
      const error = new Error('Network error');
      vi.mocked(ApiClient.prototype.fetchConfig).mockRejectedValue(error);

      const onError = vi.fn();
      const { fetchConfig } = usePlanConfig({
        authManager: createMockAuthManager(),
        onError,
      });

      await fetchConfig();

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('wraps non-Error in Error', async () => {
      vi.mocked(ApiClient.prototype.fetchConfig).mockRejectedValue('string error');

      const onError = vi.fn();
      const { fetchConfig } = usePlanConfig({
        authManager: createMockAuthManager(),
        onError,
      });

      await fetchConfig();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toBe('Failed to fetch config');
    });

    it('resets isLoading after error', async () => {
      vi.mocked(ApiClient.prototype.fetchConfig).mockRejectedValue(new Error());

      const { isLoading, fetchConfig } = usePlanConfig({
        authManager: createMockAuthManager(),
      });

      await fetchConfig();

      expect(isLoading.value).toBe(false);
    });
  });
});
