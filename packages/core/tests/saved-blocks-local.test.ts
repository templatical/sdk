import { describe, expect, it, vi } from 'vitest';
import { createLocalStorageSavedBlocksProvider } from '../src/saved-blocks-local';
import { createTitleBlock } from '@templatical/types';

const DEFAULT_KEY = 'templatical:saved-blocks';

/** Minimal in-memory Storage stub. `vi.unstubAllGlobals` in setup.ts cleans up. */
function stubLocalStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map<string, string>(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

describe('createLocalStorageSavedBlocksProvider', () => {
  describe('list', () => {
    it('returns an empty array when nothing is stored', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();

      expect(await provider.list()).toEqual([]);
    });

    it('returns stored blocks', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      const created = await provider.create({ name: 'Header', content: [] });

      expect(await provider.list()).toEqual([created]);
    });

    it('filters by name, case-insensitively', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      await provider.create({ name: 'Header', content: [] });
      await provider.create({ name: 'Footer', content: [] });

      const hits = await provider.list({ search: 'HEAD' });

      expect(hits).toHaveLength(1);
      expect(hits[0].name).toBe('Header');
    });

    it('treats a blank search as no filter', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      await provider.create({ name: 'Header', content: [] });
      await provider.create({ name: 'Footer', content: [] });

      expect(await provider.list({ search: '   ' })).toHaveLength(2);
    });

    it('returns an empty array when the search matches nothing', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      await provider.create({ name: 'Header', content: [] });

      expect(await provider.list({ search: 'nope' })).toEqual([]);
    });

    it('recovers from malformed JSON instead of throwing', async () => {
      stubLocalStorage({ [DEFAULT_KEY]: '{not json' });
      const provider = createLocalStorageSavedBlocksProvider();

      expect(await provider.list()).toEqual([]);
    });

    it('recovers when the stored value is valid JSON but not an array', async () => {
      stubLocalStorage({ [DEFAULT_KEY]: '{"nope":true}' });
      const provider = createLocalStorageSavedBlocksProvider();

      expect(await provider.list()).toEqual([]);
    });
  });

  describe('create', () => {
    it('assigns an id and timestamps, and preserves content', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      const block = createTitleBlock();

      const created = await provider.create({ name: 'Hero', content: [block] });

      expect(created.name).toBe('Hero');
      expect(created.content).toEqual([block]);
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(created.created_at).toBe(created.updated_at);
      expect(Number.isNaN(Date.parse(created.created_at!))).toBe(false);
    });

    it('stores newest-first', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      await provider.create({ name: 'First', content: [] });
      await provider.create({ name: 'Second', content: [] });

      const all = await provider.list();

      expect(all.map((b) => b.name)).toEqual(['Second', 'First']);
    });

    it('gives each created block a distinct id', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      const a = await provider.create({ name: 'A', content: [] });
      const b = await provider.create({ name: 'B', content: [] });

      expect(a.id).not.toBe(b.id);
    });

    it('persists across provider instances sharing the same storage', async () => {
      stubLocalStorage();
      await createLocalStorageSavedBlocksProvider().create({ name: 'Header', content: [] });

      const fresh = createLocalStorageSavedBlocksProvider();

      expect((await fresh.list()).map((b) => b.name)).toEqual(['Header']);
    });

    it('writes under a custom key when configured', async () => {
      const store = stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider({ key: 'custom:key' });
      await provider.create({ name: 'Header', content: [] });

      expect(store.has('custom:key')).toBe(true);
      expect(store.has(DEFAULT_KEY)).toBe(false);
    });

    it('isolates providers configured with different keys', async () => {
      stubLocalStorage();
      const a = createLocalStorageSavedBlocksProvider({ key: 'a' });
      const b = createLocalStorageSavedBlocksProvider({ key: 'b' });
      await a.create({ name: 'OnlyInA', content: [] });

      expect(await b.list()).toEqual([]);
      expect((await a.list()).map((x) => x.name)).toEqual(['OnlyInA']);
    });
  });

  describe('update', () => {
    it('renames and bumps updated_at without touching created_at', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      const created = await provider.create({ name: 'Old', content: [] });

      const updated = await provider.update(created.id, { name: 'New' });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('New');
      expect(updated.created_at).toBe(created.created_at);
      expect(Date.parse(updated.updated_at!)).toBeGreaterThanOrEqual(
        Date.parse(created.updated_at!),
      );
    });

    it('replaces content when patched', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      const created = await provider.create({ name: 'Hero', content: [] });
      const block = createTitleBlock();

      const updated = await provider.update(created.id, { content: [block] });

      expect(updated.content).toEqual([block]);
      expect(updated.name).toBe('Hero');
    });

    it('persists the update', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      const created = await provider.create({ name: 'Old', content: [] });
      await provider.update(created.id, { name: 'New' });

      expect((await provider.list()).map((b) => b.name)).toEqual(['New']);
    });

    it('preserves list position on update', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      await provider.create({ name: 'First', content: [] });
      const second = await provider.create({ name: 'Second', content: [] });
      await provider.update(second.id, { name: 'Renamed' });

      expect((await provider.list()).map((b) => b.name)).toEqual(['Renamed', 'First']);
    });

    it('rejects for an unknown id, mirroring a REST 404', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();

      await expect(provider.update('nope', { name: 'x' })).rejects.toThrow(
        'Saved block not found: nope',
      );
    });
  });

  describe('delete', () => {
    it('removes the block', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();
      const a = await provider.create({ name: 'A', content: [] });
      await provider.create({ name: 'B', content: [] });

      await provider.delete(a.id);

      expect((await provider.list()).map((b) => b.name)).toEqual(['B']);
    });

    it('rejects for an unknown id', async () => {
      stubLocalStorage();
      const provider = createLocalStorageSavedBlocksProvider();

      await expect(provider.delete('nope')).rejects.toThrow('Saved block not found: nope');
    });
  });

  describe('without localStorage', () => {
    it('throws an actionable error naming the provider', async () => {
      vi.stubGlobal('localStorage', undefined);
      const provider = createLocalStorageSavedBlocksProvider();

      await expect(provider.list()).rejects.toThrow(
        /createLocalStorageSavedBlocksProvider requires a browser environment/,
      );
    });
  });
});
