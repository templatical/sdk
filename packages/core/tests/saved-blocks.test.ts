import { describe, expect, it, vi } from 'vitest';
import { useSavedBlocks } from '../src/saved-blocks';
import type { SavedBlock, SavedBlocksProvider } from '@templatical/types';

function createSavedBlock(id: string, name: string): SavedBlock {
  return { id, name, content: [], created_at: '', updated_at: '' };
}

/**
 * Minimal stub of the public provider contract. Every method is a vi.fn so
 * tests can assert the exact arguments the composable forwards.
 */
function createMockProvider(
  overrides: Partial<SavedBlocksProvider> = {},
): SavedBlocksProvider {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(createSavedBlock('new', 'New')),
    update: vi.fn().mockResolvedValue(createSavedBlock('new', 'New')),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useSavedBlocks', () => {
  it('starts with an empty list and not loading', () => {
    const { savedBlocks, isLoading } = useSavedBlocks({
      provider: createMockProvider(),
    });

    expect(savedBlocks.value).toEqual([]);
    expect(isLoading.value).toBe(false);
  });

  describe('load', () => {
    it('loads saved blocks from the provider', async () => {
      const stored = [createSavedBlock('b1', 'Header'), createSavedBlock('b2', 'Footer')];
      const provider = createMockProvider({ list: vi.fn().mockResolvedValue(stored) });

      const { savedBlocks, load } = useSavedBlocks({ provider });
      await load();

      expect(savedBlocks.value).toEqual(stored);
    });

    it('forwards the search term as a params object', async () => {
      const provider = createMockProvider();

      const { load } = useSavedBlocks({ provider });
      await load('header');

      expect(provider.list).toHaveBeenCalledWith({ search: 'header' });
    });

    it('passes undefined search when called with no argument', async () => {
      const provider = createMockProvider();

      const { load } = useSavedBlocks({ provider });
      await load();

      expect(provider.list).toHaveBeenCalledWith({ search: undefined });
    });

    it('sets isLoading during the fetch and clears it after', async () => {
      const provider = createMockProvider();

      const { isLoading, load } = useSavedBlocks({ provider });

      const promise = load();
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('clears isLoading even when the provider rejects', async () => {
      const provider = createMockProvider({
        list: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      const { isLoading, load } = useSavedBlocks({ provider });

      await expect(load()).rejects.toThrow('Network error');
      expect(isLoading.value).toBe(false);
    });

    it('calls onError and rethrows on failure', async () => {
      const error = new Error('Network error');
      const provider = createMockProvider({ list: vi.fn().mockRejectedValue(error) });
      const onError = vi.fn();

      const { load, savedBlocks } = useSavedBlocks({ provider, onError });

      await expect(load()).rejects.toThrow('Network error');
      expect(onError).toHaveBeenCalledWith(error);
      expect(savedBlocks.value).toEqual([]);
    });
  });

  describe('create', () => {
    it('prepends the created block to the list', async () => {
      const existing = createSavedBlock('b1', 'Header');
      const created = createSavedBlock('b2', 'Footer');
      const provider = createMockProvider({
        list: vi.fn().mockResolvedValue([existing]),
        create: vi.fn().mockResolvedValue(created),
      });

      const { savedBlocks, load, create } = useSavedBlocks({ provider });

      await load();
      const result = await create('Footer', []);

      expect(result).toEqual(created);
      expect(savedBlocks.value[0]).toEqual(created);
      expect(savedBlocks.value[1]).toEqual(existing);
    });

    it('forwards name and content to the provider', async () => {
      const provider = createMockProvider();

      const { create } = useSavedBlocks({ provider });
      await create('Hero', []);

      expect(provider.create).toHaveBeenCalledWith({ name: 'Hero', content: [] });
    });

    it('creates with an empty name string', async () => {
      const created = createSavedBlock('b1', '');
      const provider = createMockProvider({ create: vi.fn().mockResolvedValue(created) });

      const { savedBlocks, create } = useSavedBlocks({ provider });
      const result = await create('', []);

      expect(result).toEqual(created);
      expect(savedBlocks.value[0].name).toBe('');
      expect(provider.create).toHaveBeenCalledWith({ name: '', content: [] });
    });

    it('calls onError and rethrows on failure, leaving the list untouched', async () => {
      const error = new Error('Create failed');
      const provider = createMockProvider({ create: vi.fn().mockRejectedValue(error) });
      const onError = vi.fn();

      const { create, savedBlocks } = useSavedBlocks({ provider, onError });

      await expect(create('Test', [])).rejects.toThrow('Create failed');
      expect(onError).toHaveBeenCalledWith(error);
      expect(savedBlocks.value).toEqual([]);
    });
  });

  describe('update', () => {
    it('replaces the matching block in the list', async () => {
      const b1 = createSavedBlock('b1', 'Header');
      const b2 = createSavedBlock('b2', 'Footer');
      const updated = createSavedBlock('b1', 'Updated Header');
      const provider = createMockProvider({
        list: vi.fn().mockResolvedValue([b1, b2]),
        update: vi.fn().mockResolvedValue(updated),
      });

      const { savedBlocks, load, update } = useSavedBlocks({ provider });

      await load();
      await update('b1', { name: 'Updated Header' });

      expect(savedBlocks.value[0]).toEqual(updated);
      expect(savedBlocks.value[1]).toEqual(b2);
    });

    it('forwards a rename as a name-only patch', async () => {
      const provider = createMockProvider();

      const { update } = useSavedBlocks({ provider });
      await update('b1', { name: 'Renamed' });

      expect(provider.update).toHaveBeenCalledWith('b1', { name: 'Renamed' });
    });

    it('leaves the list unchanged when the id is not present locally', async () => {
      const b1 = createSavedBlock('b1', 'Header');
      const updated = createSavedBlock('nonexistent', 'Updated');
      const provider = createMockProvider({
        list: vi.fn().mockResolvedValue([b1]),
        update: vi.fn().mockResolvedValue(updated),
      });

      const { savedBlocks, load, update } = useSavedBlocks({ provider });

      await load();
      const result = await update('nonexistent', { name: 'Updated' });

      // The provider response is still returned to the caller...
      expect(result).toEqual(updated);
      // ...but the local list has no matching id, so it stays as-is.
      expect(savedBlocks.value).toHaveLength(1);
      expect(savedBlocks.value[0]).toEqual(b1);
    });

    it('calls onError and rethrows on failure', async () => {
      const error = new Error('Update failed');
      const provider = createMockProvider({ update: vi.fn().mockRejectedValue(error) });
      const onError = vi.fn();

      const { update } = useSavedBlocks({ provider, onError });

      await expect(update('b1', { name: 'x' })).rejects.toThrow('Update failed');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('remove', () => {
    it('removes the block from the list', async () => {
      const b1 = createSavedBlock('b1', 'Header');
      const b2 = createSavedBlock('b2', 'Footer');
      const provider = createMockProvider({
        list: vi.fn().mockResolvedValue([b1, b2]),
      });

      const { savedBlocks, load, remove } = useSavedBlocks({ provider });

      await load();
      await remove('b1');

      expect(savedBlocks.value).toEqual([b2]);
      expect(provider.delete).toHaveBeenCalledWith('b1');
    });

    it('calls onError and rethrows on failure, keeping the block in the list', async () => {
      const b1 = createSavedBlock('b1', 'Header');
      const error = new Error('Delete failed');
      const provider = createMockProvider({
        list: vi.fn().mockResolvedValue([b1]),
        delete: vi.fn().mockRejectedValue(error),
      });
      const onError = vi.fn();

      const { savedBlocks, load, remove } = useSavedBlocks({ provider, onError });

      await load();
      await expect(remove('b1')).rejects.toThrow('Delete failed');

      expect(onError).toHaveBeenCalledWith(error);
      expect(savedBlocks.value).toEqual([b1]);
    });

    it('rethrows without onError when none is provided', async () => {
      const provider = createMockProvider({
        delete: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });

      const { remove } = useSavedBlocks({ provider });

      await expect(remove('b1')).rejects.toThrow('Delete failed');
    });
  });
});
