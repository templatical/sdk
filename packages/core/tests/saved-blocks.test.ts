import { describe, expect, it, vi } from 'vitest';
import { useSavedBlocks } from '../src/saved-blocks';
import type { SavedBlock, SavedBlocksProvider } from '@templatical/types';

function createSavedBlock(id: string, name: string): SavedBlock {
  return { id, name, content: [], createdAt: '', updatedAt: '' };
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

    /* `load` forwards its params verbatim. The editor's own browser always
       calls it bare and filters in memory; these params only arrive from
       headless callers driving the composable themselves. */
    it('forwards a search term to the provider', async () => {
      const provider = createMockProvider();

      const { load } = useSavedBlocks({ provider });
      await load({ search: 'header' });

      expect(provider.list).toHaveBeenCalledWith({ search: 'header' });
    });

    it('forwards a category filter to the provider', async () => {
      const provider = createMockProvider();

      const { load } = useSavedBlocks({ provider });
      await load({ category: 'Promos' });

      expect(provider.list).toHaveBeenCalledWith({ category: 'Promos' });
    });

    it('forwards both filters together', async () => {
      const provider = createMockProvider();

      const { load } = useSavedBlocks({ provider });
      await load({ search: 'header', category: 'Promos' });

      expect(provider.list).toHaveBeenCalledWith({
        search: 'header',
        category: 'Promos',
      });
    });

    it('passes nothing through when called with no argument', async () => {
      const provider = createMockProvider();

      const { load } = useSavedBlocks({ provider });
      await load();

      // Bare, not `{ search: undefined }` — a provider inspecting its argument
      // sees "no filters requested" rather than an object of empty keys.
      expect(provider.list).toHaveBeenCalledWith(undefined);
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

describe('useSavedBlocks categories', () => {
  function categorised(
    id: string,
    name: string,
    category?: string,
  ): SavedBlock {
    return { id, name, content: [], ...(category ? { category } : {}) };
  }

  /* Derived, never stored: a category exists exactly as long as some entry
     carries it, which is what lets the browser build its filter without a
     registry or a fifth provider method. */
  it('derives the distinct categories of the loaded entries', async () => {
    const provider = createMockProvider({
      list: vi.fn().mockResolvedValue([
        categorised('a', 'A', 'Promos'),
        categorised('b', 'B', 'Headers'),
        categorised('c', 'C', 'Promos'),
      ]),
    });

    const { categories, load } = useSavedBlocks({ provider });
    await load();

    expect(categories.value).toEqual(['Headers', 'Promos']);
  });

  it('sorts alphabetically regardless of provider order', async () => {
    const provider = createMockProvider({
      list: vi.fn().mockResolvedValue([
        categorised('a', 'A', 'Zeta'),
        categorised('b', 'B', 'alpha'),
        categorised('c', 'C', 'Mid'),
      ]),
    });

    const { categories, load } = useSavedBlocks({ provider });
    await load();

    // `localeCompare`, so case doesn't push lowercase to the end.
    expect(categories.value).toEqual(['alpha', 'Mid', 'Zeta']);
  });

  it('ignores entries with no category, and blank ones', async () => {
    const provider = createMockProvider({
      list: vi.fn().mockResolvedValue([
        categorised('a', 'A'),
        categorised('b', 'B', '   '),
        categorised('c', 'C', 'Real'),
      ]),
    });

    const { categories, load } = useSavedBlocks({ provider });
    await load();

    expect(categories.value).toEqual(['Real']);
  });

  it('is empty when nothing is categorised', async () => {
    const provider = createMockProvider({
      list: vi.fn().mockResolvedValue([categorised('a', 'A')]),
    });

    const { categories, load } = useSavedBlocks({ provider });
    await load();

    expect(categories.value).toEqual([]);
  });

  it('picks up a category introduced by a create', async () => {
    const provider = createMockProvider({
      create: vi.fn().mockResolvedValue(categorised('n', 'New', 'Fresh')),
    });

    const { categories, create } = useSavedBlocks({ provider });
    expect(categories.value).toEqual([]);

    await create('New', [], 'Fresh');

    expect(categories.value).toEqual(['Fresh']);
  });

  it('drops a category whose last entry was removed', async () => {
    const provider = createMockProvider({
      list: vi
        .fn()
        .mockResolvedValue([
          categorised('a', 'A', 'Solo'),
          categorised('b', 'B', 'Kept'),
        ]),
    });

    const { categories, load, remove } = useSavedBlocks({ provider });
    await load();
    expect(categories.value).toEqual(['Kept', 'Solo']);

    await remove('a');

    expect(categories.value).toEqual(['Kept']);
  });

  it('follows a recategorising update', async () => {
    const provider = createMockProvider({
      list: vi.fn().mockResolvedValue([categorised('a', 'A', 'Before')]),
      update: vi.fn().mockResolvedValue(categorised('a', 'A', 'After')),
    });

    const { categories, load, update } = useSavedBlocks({ provider });
    await load();
    expect(categories.value).toEqual(['Before']);

    await update('a', { category: 'After' });

    expect(categories.value).toEqual(['After']);
  });
});

describe('useSavedBlocks create with category', () => {
  it('sends the category through to the provider', async () => {
    const provider = createMockProvider();

    const { create } = useSavedBlocks({ provider });
    await create('Hero', [], 'Promos');

    expect(provider.create).toHaveBeenCalledWith({
      name: 'Hero',
      content: [],
      category: 'Promos',
    });
  });

  it('omits the key entirely when no category is given', async () => {
    const provider = createMockProvider();

    const { create } = useSavedBlocks({ provider });
    await create('Hero', []);

    // Not `{ category: undefined }` — a provider serialising this to JSON
    // should not receive a field the caller never set.
    expect(provider.create).toHaveBeenCalledWith({ name: 'Hero', content: [] });
    const [input] = (provider.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect('category' in input).toBe(false);
  });

  it('omits the key for an empty-string category', async () => {
    const provider = createMockProvider();

    const { create } = useSavedBlocks({ provider });
    await create('Hero', [], '');

    const [input] = (provider.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect('category' in input).toBe(false);
  });
});

describe('useSavedBlocks permissions', () => {
  function entry(
    id: string,
    flags: Partial<Pick<SavedBlock, 'canUpdate' | 'canDelete'>> = {},
  ): SavedBlock {
    return { id, name: id, content: [], ...flags };
  }

  /* A provider passes `false` instead of a function to withhold a mutation.
     Required rather than optional so disabling is stated, never accidental. */
  describe('capability flags', () => {
    it('reports all three enabled for a fully implemented provider', () => {
      const { canCreate, canUpdate, canDelete } = useSavedBlocks({
        provider: createMockProvider(),
      });

      expect(canCreate.value).toBe(true);
      expect(canUpdate.value).toBe(true);
      expect(canDelete.value).toBe(true);
    });

    it('reports create disabled without affecting the others', () => {
      const { canCreate, canUpdate, canDelete } = useSavedBlocks({
        provider: createMockProvider({ create: false }),
      });

      expect(canCreate.value).toBe(false);
      expect(canUpdate.value).toBe(true);
      expect(canDelete.value).toBe(true);
    });

    it('reports update disabled without affecting the others', () => {
      const { canCreate, canUpdate, canDelete } = useSavedBlocks({
        provider: createMockProvider({ update: false }),
      });

      expect(canUpdate.value).toBe(false);
      expect(canCreate.value).toBe(true);
      expect(canDelete.value).toBe(true);
    });

    it('reports delete disabled without affecting the others', () => {
      const { canCreate, canUpdate, canDelete } = useSavedBlocks({
        provider: createMockProvider({ delete: false }),
      });

      expect(canDelete.value).toBe(false);
      expect(canCreate.value).toBe(true);
      expect(canUpdate.value).toBe(true);
    });

    // The read-only library: browse and insert still work, because inserting
    // never touches the store.
    it('supports a fully read-only provider that can still list', async () => {
      const stored = [entry('a')];
      const { canCreate, canUpdate, canDelete, savedBlocks, load } =
        useSavedBlocks({
          provider: createMockProvider({
            list: vi.fn().mockResolvedValue(stored),
            create: false,
            update: false,
            delete: false,
          }),
        });

      await load();

      expect([canCreate.value, canUpdate.value, canDelete.value]).toEqual([
        false,
        false,
        false,
      ]);
      expect(savedBlocks.value).toEqual(stored);
    });
  });

  describe('refusing disabled mutations', () => {
    /* The UI hides these, so arriving here means a programmatic caller went
       around it — reject rather than resolve, or the caller reads it as saved. */
    it('rejects create when the provider disabled it', async () => {
      const { create } = useSavedBlocks({
        provider: createMockProvider({ create: false }),
      });

      await expect(create('Hero', [])).rejects.toThrow(/create is disabled/);
    });

    it('rejects update when the provider disabled it', async () => {
      const { update } = useSavedBlocks({
        provider: createMockProvider({ update: false }),
      });

      await expect(update('a', { name: 'x' })).rejects.toThrow(
        /update is disabled/,
      );
    });

    it('rejects remove when the provider disabled it', async () => {
      const { remove } = useSavedBlocks({
        provider: createMockProvider({ delete: false }),
      });

      await expect(remove('a')).rejects.toThrow(/delete is disabled/);
    });

    it('leaves the list untouched when a mutation is refused', async () => {
      const stored = [entry('a')];
      const { savedBlocks, load, remove } = useSavedBlocks({
        provider: createMockProvider({
          list: vi.fn().mockResolvedValue(stored),
          delete: false,
        }),
      });
      await load();

      await expect(remove('a')).rejects.toThrow();

      expect(savedBlocks.value).toEqual(stored);
    });

    it('never calls the provider for a refused mutation', async () => {
      const provider = createMockProvider({ create: false });

      const { create } = useSavedBlocks({ provider });
      await expect(create('Hero', [])).rejects.toThrow();

      // `list` is the only thing that should have been reachable.
      expect(provider.list).not.toHaveBeenCalled();
    });
  });

  describe('per-entry permissions', () => {
    /* Absent means allowed: the capability flags already say whether an action
       exists at all, so these exist purely to carve out exceptions. */
    it('allows an entry with no flags', async () => {
      const { canUpdateBlock, canDeleteBlock } = useSavedBlocks({
        provider: createMockProvider(),
      });
      const block = entry('a');

      expect(canUpdateBlock(block)).toBe(true);
      expect(canDeleteBlock(block)).toBe(true);
    });

    it('honours an explicit false per entry', () => {
      const { canUpdateBlock, canDeleteBlock } = useSavedBlocks({
        provider: createMockProvider(),
      });

      expect(canUpdateBlock(entry('a', { canUpdate: false }))).toBe(false);
      expect(canDeleteBlock(entry('a', { canDelete: false }))).toBe(false);
    });

    it('treats the two flags independently', () => {
      const { canUpdateBlock, canDeleteBlock } = useSavedBlocks({
        provider: createMockProvider(),
      });
      const block = entry('a', { canUpdate: false, canDelete: true });

      expect(canUpdateBlock(block)).toBe(false);
      expect(canDeleteBlock(block)).toBe(true);
    });

    it('an entry flag cannot re-enable a capability the provider withheld', () => {
      const { canUpdateBlock } = useSavedBlocks({
        provider: createMockProvider({ update: false }),
      });

      // `canUpdate: true` is not an override — the capability wins.
      expect(canUpdateBlock(entry('a', { canUpdate: true }))).toBe(false);
    });

    it('rejects updating a loaded entry that opted out', async () => {
      const { load, update } = useSavedBlocks({
        provider: createMockProvider({
          list: vi.fn().mockResolvedValue([entry('a', { canUpdate: false })]),
        }),
      });
      await load();

      await expect(update('a', { name: 'x' })).rejects.toThrow(
        /not permitted for entry "a"/,
      );
    });

    it('rejects deleting a loaded entry that opted out', async () => {
      const { load, remove } = useSavedBlocks({
        provider: createMockProvider({
          list: vi.fn().mockResolvedValue([entry('a', { canDelete: false })]),
        }),
      });
      await load();

      await expect(remove('a')).rejects.toThrow(/not permitted for entry "a"/);
    });

    it('still permits sibling entries that did not opt out', async () => {
      const provider = createMockProvider({
        list: vi
          .fn()
          .mockResolvedValue([entry('locked', { canDelete: false }), entry('free')]),
      });
      const { load, remove } = useSavedBlocks({ provider });
      await load();

      await remove('free');

      expect(provider.delete).toHaveBeenCalledWith('free');
    });

    it('does not refuse an id that was never loaded', async () => {
      // A headless caller may legitimately patch something outside the list.
      const provider = createMockProvider();
      const { update } = useSavedBlocks({ provider });

      await update('never-loaded', { name: 'x' });

      expect(provider.update).toHaveBeenCalledWith('never-loaded', {
        name: 'x',
      });
    });
  });
});

describe('useSavedBlocks events', () => {
  it('fires onCreated once with the created block', async () => {
    const created = createSavedBlock('b2', 'Footer');
    const onCreated = vi.fn();
    const provider = createMockProvider({
      create: vi.fn().mockResolvedValue(created),
      onCreated,
    });

    const { create } = useSavedBlocks({ provider });
    await create('Footer', []);

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('keeps create successful when onCreated throws, and reports through onError', async () => {
    const onError = vi.fn();
    const provider = createMockProvider({
      onCreated: () => {
        throw new Error('handler blew up');
      },
    });

    const { create } = useSavedBlocks({ provider, onError });

    await expect(create('Footer', [])).resolves.toMatchObject({ id: 'new' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('handler blew up');
  });

  it('fires onUpdated once with the updated block', async () => {
    const updated = createSavedBlock('b1', 'Updated Header');
    const onUpdated = vi.fn();
    const provider = createMockProvider({
      update: vi.fn().mockResolvedValue(updated),
      onUpdated,
    });

    const { update } = useSavedBlocks({ provider });
    await update('b1', { name: 'Updated Header' });

    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it('keeps update successful when onUpdated throws, and reports through onError', async () => {
    const onError = vi.fn();
    const provider = createMockProvider({
      onUpdated: () => {
        throw new Error('handler blew up');
      },
    });

    const { update } = useSavedBlocks({ provider, onError });

    await expect(update('b1', { name: 'x' })).resolves.toMatchObject({
      id: 'new',
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('handler blew up');
  });

  it('fires onDeleted with the removed block itself, not just its id', async () => {
    const b1 = createSavedBlock('b1', 'Header');
    const onDeleted = vi.fn();
    const provider = createMockProvider({
      list: vi.fn().mockResolvedValue([b1]),
      onDeleted,
    });

    const { load, remove } = useSavedBlocks({ provider });
    await load();
    await remove('b1');

    // An implementation passing just the id would satisfy a bare "was
    // called" check — asserting a property (and full equality) catches that.
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onDeleted.mock.calls[0][0].name).toBe('Header');
    expect(onDeleted).toHaveBeenCalledWith(b1);
  });

  it('fires nothing when the deleted id was never loaded locally', async () => {
    const onDeleted = vi.fn();
    const provider = createMockProvider({ onDeleted });

    const { remove } = useSavedBlocks({ provider });
    await remove('never-loaded');

    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('keeps delete successful when onDeleted throws, and reports through onError', async () => {
    const b1 = createSavedBlock('b1', 'Header');
    const onError = vi.fn();
    const provider = createMockProvider({
      list: vi.fn().mockResolvedValue([b1]),
      onDeleted: () => {
        throw new Error('handler blew up');
      },
    });

    const { load, remove, savedBlocks } = useSavedBlocks({
      provider,
      onError,
    });
    await load();
    await remove('b1');

    expect(savedBlocks.value).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('handler blew up');
  });
});
