import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSnapshotHistory } from '../../src/cloud/snapshots';
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

describe('useSnapshotHistory', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
  });

  it('starts with empty state', () => {
    const { snapshots, isLoading, isRestoring } = useSnapshotHistory({
      authManager: createMockAuthManager(),
      templateId: 'tmpl-1',
    });

    expect(snapshots.value).toEqual([]);
    expect(isLoading.value).toBe(false);
    expect(isRestoring.value).toBe(false);
  });

  describe('loadSnapshots', () => {
    it('loads snapshots from API', async () => {
      const mockSnapshots = [
        { id: 'snap-1', created_at: '2024-01-01' },
        { id: 'snap-2', created_at: '2024-01-02' },
      ];
      vi.mocked(ApiClient.prototype.getSnapshots).mockResolvedValue(mockSnapshots as any);

      const { snapshots, loadSnapshots } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
      });

      await loadSnapshots();

      expect(snapshots.value).toEqual(mockSnapshots);
      expect(ApiClient.prototype.getSnapshots).toHaveBeenCalledWith('tmpl-1');
    });

    it('sets isLoading during fetch', async () => {
      vi.mocked(ApiClient.prototype.getSnapshots).mockResolvedValue([]);

      const { isLoading, loadSnapshots } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
      });

      const promise = loadSnapshots();
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('calls onError and rethrows on failure', async () => {
      const error = new Error('Load failed');
      vi.mocked(ApiClient.prototype.getSnapshots).mockRejectedValue(error);

      const onError = vi.fn();
      const { loadSnapshots } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
        onError,
      });

      await expect(loadSnapshots()).rejects.toThrow('Load failed');
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('resets isLoading after error', async () => {
      vi.mocked(ApiClient.prototype.getSnapshots).mockRejectedValue(new Error());

      const { isLoading, loadSnapshots } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
      });

      await loadSnapshots().catch(() => {});
      expect(isLoading.value).toBe(false);
    });
  });

  describe('restoreSnapshot', () => {
    it('restores a snapshot and calls onRestore', async () => {
      const template = { id: 'tmpl-1', content: {} };
      vi.mocked(ApiClient.prototype.restoreSnapshot).mockResolvedValue(template as any);

      const onRestore = vi.fn();
      const { restoreSnapshot } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
        onRestore,
      });

      const result = await restoreSnapshot('snap-1');

      expect(result).toEqual(template);
      expect(onRestore).toHaveBeenCalledWith(template);
      expect(ApiClient.prototype.restoreSnapshot).toHaveBeenCalledWith('tmpl-1', 'snap-1');
    });

    it('sets isRestoring during operation', async () => {
      vi.mocked(ApiClient.prototype.restoreSnapshot).mockResolvedValue({} as any);

      const { isRestoring, restoreSnapshot } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
      });

      const promise = restoreSnapshot('snap-1');
      expect(isRestoring.value).toBe(true);

      await promise;
      expect(isRestoring.value).toBe(false);
    });

    it('calls onError and rethrows on failure', async () => {
      const error = new Error('Restore failed');
      vi.mocked(ApiClient.prototype.restoreSnapshot).mockRejectedValue(error);

      const onError = vi.fn();
      const { restoreSnapshot } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
        onError,
      });

      await expect(restoreSnapshot('snap-1')).rejects.toThrow('Restore failed');
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('resets isRestoring after error', async () => {
      vi.mocked(ApiClient.prototype.restoreSnapshot).mockRejectedValue(new Error());

      const { isRestoring, restoreSnapshot } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
      });

      await restoreSnapshot('snap-1').catch(() => {});
      expect(isRestoring.value).toBe(false);
    });

    it('resets isRestoring even when onRestore callback throws', async () => {
      const template = { id: 'tmpl-1', content: {} };
      vi.mocked(ApiClient.prototype.restoreSnapshot).mockResolvedValue(template as any);

      const onRestore = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const onError = vi.fn();

      const { isRestoring, restoreSnapshot } = useSnapshotHistory({
        authManager: createMockAuthManager(),
        templateId: 'tmpl-1',
        onRestore,
        onError,
      });

      await expect(restoreSnapshot('snap-1')).rejects.toThrow('Callback error');

      expect(isRestoring.value).toBe(false);
      expect(onRestore).toHaveBeenCalledWith(template);
      // onError is called because the thrown error propagates through catch
      expect(onError).toHaveBeenCalled();
    });
  });
});
