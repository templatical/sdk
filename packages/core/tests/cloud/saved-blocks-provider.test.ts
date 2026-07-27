import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCloudSavedBlocksProvider } from '../../src/cloud/saved-blocks-provider';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import type { SavedBlock } from '@templatical/types';
import { createTitleBlock } from '@templatical/types';

vi.mock('../../src/cloud/api');

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

function createSavedBlock(id: string, name: string): SavedBlock {
  return { id, name, content: [], created_at: '', updated_at: '' };
}

/**
 * The Cloud adapter must keep hitting the same `ApiClient` saved-module
 * endpoints as before saved blocks became an OSS feature — the backend REST
 * contract is unchanged, only the client-side layering moved.
 */
describe('createCloudSavedBlocksProvider', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
  });

  it('maps list() to ApiClient.listModules with the search term', async () => {
    const stored = [createSavedBlock('b1', 'Header')];
    vi.mocked(ApiClient.prototype.listModules).mockResolvedValue(stored);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    const result = await provider.list({ search: 'head' });

    expect(ApiClient.prototype.listModules).toHaveBeenCalledWith(
      'head',
      undefined,
    );
    expect(result).toEqual(stored);
  });

  it('maps list() to ApiClient.listModules with the category filter', async () => {
    vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([]);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    await provider.list({ category: 'Promos' });

    expect(ApiClient.prototype.listModules).toHaveBeenCalledWith(
      undefined,
      'Promos',
    );
  });

  it('forwards both filters together', async () => {
    vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([]);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    await provider.list({ search: 'head', category: 'Promos' });

    expect(ApiClient.prototype.listModules).toHaveBeenCalledWith(
      'head',
      'Promos',
    );
  });

  it('passes undefined when list() is called with no params', async () => {
    vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([]);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    await provider.list();

    expect(ApiClient.prototype.listModules).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
  });

  it('passes undefined when params omit both filters', async () => {
    vi.mocked(ApiClient.prototype.listModules).mockResolvedValue([]);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    await provider.list({});

    expect(ApiClient.prototype.listModules).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
  });

  it('forwards category on create, so Cloud works once the column lands', async () => {
    const created = createSavedBlock('b1', 'Hero');
    vi.mocked(ApiClient.prototype.createModule).mockResolvedValue(created);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    const content = [createTitleBlock()];
    await provider.create({ name: 'Hero', content, category: 'Promos' });

    expect(ApiClient.prototype.createModule).toHaveBeenCalledWith({
      name: 'Hero',
      content,
      category: 'Promos',
    });
  });

  it('forwards a category-only patch on update', async () => {
    const updated = createSavedBlock('b1', 'Hero');
    vi.mocked(ApiClient.prototype.updateModule).mockResolvedValue(updated);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    await provider.update('b1', { category: 'Footers' });

    expect(ApiClient.prototype.updateModule).toHaveBeenCalledWith('b1', {
      category: 'Footers',
    });
  });

  it('maps create() to ApiClient.createModule', async () => {
    const block = createTitleBlock();
    const created = createSavedBlock('b1', 'Hero');
    vi.mocked(ApiClient.prototype.createModule).mockResolvedValue(created);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    const result = await provider.create({ name: 'Hero', content: [block] });

    expect(ApiClient.prototype.createModule).toHaveBeenCalledWith({
      name: 'Hero',
      content: [block],
    });
    expect(result).toEqual(created);
  });

  it('maps update() to ApiClient.updateModule, preserving id and patch', async () => {
    const updated = createSavedBlock('b1', 'Renamed');
    vi.mocked(ApiClient.prototype.updateModule).mockResolvedValue(updated);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    const result = await provider.update('b1', { name: 'Renamed' });

    expect(ApiClient.prototype.updateModule).toHaveBeenCalledWith('b1', {
      name: 'Renamed',
    });
    expect(result).toEqual(updated);
  });

  it('maps delete() to ApiClient.deleteModule', async () => {
    vi.mocked(ApiClient.prototype.deleteModule).mockResolvedValue(undefined);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());
    await provider.delete('b1');

    expect(ApiClient.prototype.deleteModule).toHaveBeenCalledWith('b1');
  });

  it('constructs the ApiClient with the supplied AuthManager', () => {
    const authManager = createMockAuthManager();

    createCloudSavedBlocksProvider(authManager);

    expect(ApiClient).toHaveBeenCalledWith(authManager);
  });

  it('propagates provider errors to the caller', async () => {
    const error = new Error('403 Forbidden');
    vi.mocked(ApiClient.prototype.listModules).mockRejectedValue(error);

    const provider = createCloudSavedBlocksProvider(createMockAuthManager());

    await expect(provider.list()).rejects.toThrow('403 Forbidden');
  });
});
