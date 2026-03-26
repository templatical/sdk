import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSavedModules } from '../../src/cloud/saved-modules';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import type { SavedModule } from '@templatical/types';

vi.mock('../../src/cloud/api');

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

function createModule(id: string, name: string): SavedModule {
  return { id, name, content: [], created_at: '', updated_at: '' } as SavedModule;
}

describe('useSavedModules', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
  });

  it('starts with empty modules and not loading', () => {
    const { modules, isLoading } = useSavedModules({
      authManager: createMockAuthManager(),
    });

    expect(modules.value).toEqual([]);
    expect(isLoading.value).toBe(false);
  });

  describe('loadModules', () => {
    it('loads modules from API', async () => {
      const mockModules = [createModule('m1', 'Header'), createModule('m2', 'Footer')];
      vi.mocked(ApiClient.prototype.listModules).mockResolvedValue(mockModules);

      const { modules, loadModules } = useSavedModules({
        authManager: createMockAuthManager(),
      });

      await loadModules();

      expect(modules.value).toEqual(mockModules);
    });

    it('passes search parameter', async () => {
      vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([]);

      const { loadModules } = useSavedModules({
        authManager: createMockAuthManager(),
      });

      await loadModules('header');

      expect(ApiClient.prototype.listModules).toHaveBeenCalledWith('header');
    });

    it('sets isLoading during fetch', async () => {
      vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([]);

      const { isLoading, loadModules } = useSavedModules({
        authManager: createMockAuthManager(),
      });

      const promise = loadModules();
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('calls onError and rethrows on failure', async () => {
      const error = new Error('Network error');
      vi.mocked(ApiClient.prototype.listModules).mockRejectedValue(error);

      const onError = vi.fn();
      const { loadModules } = useSavedModules({
        authManager: createMockAuthManager(),
        onError,
      });

      await expect(loadModules()).rejects.toThrow('Network error');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('createModule', () => {
    it('prepends new module to list', async () => {
      const existing = createModule('m1', 'Header');
      const newModule = createModule('m2', 'Footer');
      vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([existing]);
      vi.mocked(ApiClient.prototype.createModule).mockResolvedValue(newModule);

      const { modules, loadModules, createModule: create } = useSavedModules({
        authManager: createMockAuthManager(),
      });

      await loadModules();
      const result = await create('Footer', []);

      expect(result).toEqual(newModule);
      expect(modules.value[0]).toEqual(newModule);
      expect(modules.value[1]).toEqual(existing);
    });

    it('calls onError and rethrows on failure', async () => {
      const error = new Error('Create failed');
      vi.mocked(ApiClient.prototype.createModule).mockRejectedValue(error);

      const onError = vi.fn();
      const { createModule: create } = useSavedModules({
        authManager: createMockAuthManager(),
        onError,
      });

      await expect(create('Test', [])).rejects.toThrow('Create failed');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('updateModule', () => {
    it('replaces module in list', async () => {
      const m1 = createModule('m1', 'Header');
      const m2 = createModule('m2', 'Footer');
      const updated = createModule('m1', 'Updated Header');

      vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([m1, m2]);
      vi.mocked(ApiClient.prototype.updateModule).mockResolvedValue(updated);

      const { modules, loadModules, updateModule } = useSavedModules({
        authManager: createMockAuthManager(),
      });

      await loadModules();
      await updateModule('m1', { name: 'Updated Header' });

      expect(modules.value[0]).toEqual(updated);
      expect(modules.value[1]).toEqual(m2);
    });
  });

  describe('deleteModule', () => {
    it('removes module from list', async () => {
      const m1 = createModule('m1', 'Header');
      const m2 = createModule('m2', 'Footer');

      vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([m1, m2]);
      vi.mocked(ApiClient.prototype.deleteModule).mockResolvedValue(undefined);

      const { modules, loadModules, deleteModule } = useSavedModules({
        authManager: createMockAuthManager(),
      });

      await loadModules();
      await deleteModule('m1');

      expect(modules.value).toEqual([m2]);
    });

    it('calls onError and rethrows on failure', async () => {
      const error = new Error('Delete failed');
      vi.mocked(ApiClient.prototype.deleteModule).mockRejectedValue(error);

      const onError = vi.fn();
      const { deleteModule } = useSavedModules({
        authManager: createMockAuthManager(),
        onError,
      });

      await expect(deleteModule('m1')).rejects.toThrow('Delete failed');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
