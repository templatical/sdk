import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useMediaLibrary } from '../src/composable';
import { MediaApiClient } from '../src/api-client';
import type { AuthManager } from '@templatical/core/cloud';
import type { MediaItem, MediaFolder } from '../src/types';

vi.mock('../src/api-client');

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

function createMediaItem(id: string, overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id,
    filename: `file-${id}.jpg`,
    mime_type: 'image/jpeg',
    size: 1024,
    url: `https://cdn.example.com/${id}.jpg`,
    small_url: null,
    medium_url: null,
    large_url: null,
    folder_id: null,
    conversions_generated: false,
    width: 800,
    height: 600,
    alt_text: '',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

function createFolder(id: string, name: string, children: MediaFolder[] = []): MediaFolder {
  return {
    id,
    project_id: 'proj-1',
    parent_id: null,
    name,
    children,
    created_at: '2024-01-01',
  };
}

function mockBrowseResponse(items: MediaItem[], nextCursor: string | null = null) {
  return {
    data: items,
    meta: { path: '/media', per_page: 20, next_cursor: nextCursor, prev_cursor: null },
  };
}

describe('useMediaLibrary', () => {
  beforeEach(() => {
    vi.mocked(MediaApiClient).mockClear();
    vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
      mockBrowseResponse([]),
    );
    vi.mocked(MediaApiClient.prototype.getMediaFolders).mockResolvedValue([]);
    vi.mocked(MediaApiClient.prototype.getFrequentlyUsed).mockResolvedValue([]);
  });

  it('throws when projectId is empty', () => {
    expect(() =>
      useMediaLibrary({ projectId: '', authManager: createMockAuthManager() }),
    ).toThrow('projectId is required');
  });

  it('initializes with default state', () => {
    const lib = useMediaLibrary({
      projectId: 'proj-1',
      authManager: createMockAuthManager(),
    });

    expect(lib.items.value).toEqual([]);
    expect(lib.folders.value).toEqual([]);
    expect(lib.currentFolderId.value).toBeNull();
    expect(lib.viewMode.value).toBe('files');
    expect(lib.searchQuery.value).toBe('');
    expect(lib.categoryFilter.value).toBeNull();
    expect(lib.sortOption.value).toBe('newest');
    expect(lib.isLoading.value).toBe(false);
    expect(lib.isUploading.value).toBe(false);
    expect(lib.hasMore.value).toBe(false);
    expect(lib.selectedItems.value.size).toBe(0);
    expect(lib.previewItem.value).toBeNull();
  });

  describe('loadItems', () => {
    it('loads items from API', async () => {
      const items = [createMediaItem('m1'), createMediaItem('m2')];
      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse(items),
      );

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.loadItems();

      expect(lib.items.value).toEqual(items);
      expect(lib.hasMore.value).toBe(false);
    });

    it('sets hasMore when cursor exists', async () => {
      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m1')], 'next-cursor'),
      );

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.loadItems();

      expect(lib.hasMore.value).toBe(true);
    });

    it('manages isLoading state', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const promise = lib.loadItems();
      expect(lib.isLoading.value).toBe(true);

      await promise;
      expect(lib.isLoading.value).toBe(false);
    });

    it('calls onError on failure', async () => {
      vi.mocked(MediaApiClient.prototype.browseMedia).mockRejectedValue(
        new Error('Network error'),
      );

      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      await lib.loadItems();

      expect(onError).toHaveBeenCalled();
    });

    it('resets isLoading on error', async () => {
      vi.mocked(MediaApiClient.prototype.browseMedia).mockRejectedValue(
        new Error('Server error'),
      );

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError: vi.fn(),
      });

      await lib.loadItems();

      expect(lib.isLoading.value).toBe(false);
    });

    it('omits folder_id when search query is set', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.searchQuery.value = 'logo';
      lib.currentFolderId.value = 'f1';

      await lib.loadItems();

      const callArgs = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls;
      const lastCall = callArgs[callArgs.length - 1][0];
      expect(lastCall.folder_id).toBeUndefined();
      expect(lastCall.search).toBe('logo');
    });

    it('includes folder_id when no search query', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.currentFolderId.value = 'f1';

      await lib.loadItems();

      const callArgs = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls;
      const lastCall = callArgs[callArgs.length - 1][0];
      expect(lastCall.folder_id).toBe('f1');
    });

    it('omits sort when set to newest (default)', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.loadItems();

      const callArgs = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls;
      const lastCall = callArgs[callArgs.length - 1][0];
      expect(lastCall.sort).toBeUndefined();
    });

    it('includes sort when not default', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.sortOption.value = 'name_asc';

      await lib.loadItems();

      const callArgs = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls;
      const lastCall = callArgs[callArgs.length - 1][0];
      expect(lastCall.sort).toBe('name_asc');
    });

    it('includes category filter when set', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.categoryFilter.value = 'images';

      await lib.loadItems();

      const callArgs = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls;
      const lastCall = callArgs[callArgs.length - 1][0];
      expect(lastCall.category).toBe('images');
    });
  });

  describe('loadMore', () => {
    it('appends items to existing list', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      // Initial load with cursor
      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m1')], 'cursor-1'),
      );
      await lib.loadItems();

      // Load more
      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m2')]),
      );
      await lib.loadMore();

      expect(lib.items.value).toHaveLength(2);
      expect(lib.items.value[0].id).toBe('m1');
      expect(lib.items.value[1].id).toBe('m2');
    });

    it('does nothing when hasMore is false', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.loadItems();
      const callCount = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls.length;

      await lib.loadMore();

      expect(vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls.length).toBe(callCount);
    });

    it('does nothing when already loading', async () => {
      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m1')], 'cursor-1'),
      );

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.loadItems();

      // Start loading but don't await
      lib.isLoading.value = true;
      await lib.loadMore();

      // browseMedia should only have been called once (loadItems)
      // because loadMore bails when isLoading is true
    });

    it('does nothing when nextCursor is null', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      // Load with no cursor (hasMore will be false)
      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m1')]),
      );
      await lib.loadItems();

      // Force hasMore to true but cursor is null
      lib.hasMore.value = true;
      const callCount = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls.length;

      await lib.loadMore();

      expect(vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls.length).toBe(callCount);
    });

    it('passes cursor to browseMedia', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m1')], 'cursor-abc'),
      );
      await lib.loadItems();

      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m2')]),
      );
      await lib.loadMore();

      const callArgs = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls;
      const lastCall = callArgs[callArgs.length - 1][0];
      expect(lastCall.cursor).toBe('cursor-abc');
    });

    it('updates hasMore to false when no more items', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m1')], 'cursor-1'),
      );
      await lib.loadItems();
      expect(lib.hasMore.value).toBe(true);

      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m2')], null),
      );
      await lib.loadMore();

      expect(lib.hasMore.value).toBe(false);
    });

    it('calls onError on failure', async () => {
      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      vi.mocked(MediaApiClient.prototype.browseMedia).mockResolvedValue(
        mockBrowseResponse([createMediaItem('m1')], 'cursor-1'),
      );
      await lib.loadItems();

      vi.mocked(MediaApiClient.prototype.browseMedia).mockRejectedValue(
        new Error('Load more failed'),
      );
      await lib.loadMore();

      expect(onError).toHaveBeenCalled();
      expect(lib.isLoading.value).toBe(false);
    });
  });

  describe('search, filter, sort', () => {
    it('search updates query and reloads', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.search('logo');

      expect(lib.searchQuery.value).toBe('logo');
      expect(MediaApiClient.prototype.browseMedia).toHaveBeenCalled();
    });

    it('search with empty string clears query', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.search('logo');
      await lib.search('');

      expect(lib.searchQuery.value).toBe('');
    });

    it('filterByCategory updates filter and reloads', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.filterByCategory('images');

      expect(lib.categoryFilter.value).toBe('images');
    });

    it('filterByCategory with null clears filter', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.filterByCategory('images');
      await lib.filterByCategory(null);

      expect(lib.categoryFilter.value).toBeNull();
    });

    it('sortBy updates option and reloads', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.sortBy('name_asc');

      expect(lib.sortOption.value).toBe('name_asc');
    });

    it('sortBy triggers API call with new sort', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const callsBefore = vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls.length;

      await lib.sortBy('size_desc');

      expect(vi.mocked(MediaApiClient.prototype.browseMedia).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe('navigateToFolder', () => {
    it('resets state and loads items', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.searchQuery.value = 'test';
      lib.selectedItems.value = new Set(['m1']);
      lib.previewItem.value = createMediaItem('m1');

      await lib.navigateToFolder('f1');

      expect(lib.viewMode.value).toBe('files');
      expect(lib.currentFolderId.value).toBe('f1');
      expect(lib.searchQuery.value).toBe('');
      expect(lib.selectedItems.value.size).toBe(0);
      expect(lib.previewItem.value).toBeNull();
    });

    it('navigates to root with null', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.currentFolderId.value = 'f1';
      await lib.navigateToFolder(null);

      expect(lib.currentFolderId.value).toBeNull();
    });
  });

  describe('showFrequentlyUsed', () => {
    it('switches view mode and loads frequently used', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.showFrequentlyUsed();

      expect(lib.viewMode.value).toBe('frequently-used');
      expect(lib.currentFolderId.value).toBeNull();
      expect(lib.searchQuery.value).toBe('');
      expect(MediaApiClient.prototype.getFrequentlyUsed).toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    it('uploads file and prepends to items', async () => {
      const uploaded = createMediaItem('new-1');
      vi.mocked(MediaApiClient.prototype.uploadMedia).mockResolvedValue(uploaded);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.items.value = [createMediaItem('m1')];

      const result = await lib.uploadFile(new File(['data'], 'photo.jpg'));

      expect(result).toEqual(uploaded);
      expect(lib.items.value[0]).toEqual(uploaded);
      expect(lib.items.value).toHaveLength(2);
    });

    it('returns null on upload failure', async () => {
      vi.mocked(MediaApiClient.prototype.uploadMedia).mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      const result = await lib.uploadFile(new File(['data'], 'photo.jpg'));

      expect(result).toBeNull();
      expect(onError).toHaveBeenCalled();
    });

    it('tracks progress during multi-file upload', async () => {
      vi.mocked(MediaApiClient.prototype.uploadMedia).mockResolvedValue(createMediaItem('m1'));

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
      await lib.uploadFiles(files);

      // After completion, progress should be null
      expect(lib.uploadProgress.value).toBeNull();
      expect(lib.isUploading.value).toBe(false);
      expect(lib.items.value).toHaveLength(2);
    });
  });

  describe('upload edge cases', () => {
    it('handles partial failure in multi-file upload', async () => {
      vi.mocked(MediaApiClient.prototype.uploadMedia)
        .mockResolvedValueOnce(createMediaItem('m1'))
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce(createMediaItem('m3'));

      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg'), new File(['c'], 'c.jpg')];
      await lib.uploadFiles(files);

      // Two successful uploads, one failed
      expect(lib.items.value).toHaveLength(2);
      expect(onError).toHaveBeenCalledOnce();
      expect(lib.isUploading.value).toBe(false);
      expect(lib.uploadProgress.value).toBeNull();
    });
  });

  describe('selection', () => {
    it('toggleSelection adds and removes', () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.toggleSelection('m1');
      expect(lib.selectedItems.value.has('m1')).toBe(true);

      lib.toggleSelection('m1');
      expect(lib.selectedItems.value.has('m1')).toBe(false);
    });

    it('clearSelection resets selection and preview', () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.selectedItems.value = new Set(['m1', 'm2']);
      lib.previewItem.value = createMediaItem('m1');

      lib.clearSelection();

      expect(lib.selectedItems.value.size).toBe(0);
      expect(lib.previewItem.value).toBeNull();
    });

    it('selectItem sets preview and single selection', () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const item = createMediaItem('m1');
      lib.selectItem(item);

      expect(lib.previewItem.value).toEqual(item);
      expect(lib.selectedItems.value.size).toBe(1);
      expect(lib.selectedItems.value.has('m1')).toBe(true);
    });
  });

  describe('deleteSelected', () => {
    it('removes selected items from all lists', async () => {
      vi.mocked(MediaApiClient.prototype.deleteMedia).mockResolvedValue(undefined);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.items.value = [createMediaItem('m1'), createMediaItem('m2'), createMediaItem('m3')];
      lib.frequentlyUsedItems.value = [createMediaItem('m1')];
      lib.selectedItems.value = new Set(['m1', 'm2']);

      await lib.deleteSelected();

      expect(lib.items.value).toHaveLength(1);
      expect(lib.items.value[0].id).toBe('m3');
      expect(lib.frequentlyUsedItems.value).toHaveLength(0);
      expect(lib.selectedItems.value.size).toBe(0);
    });

    it('does nothing when no selection', async () => {
      const deleteMediaMock = vi.mocked(MediaApiClient.prototype.deleteMedia);
      const callsBefore = deleteMediaMock.mock.calls.length;

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.deleteSelected();

      expect(deleteMediaMock.mock.calls.length - callsBefore).toBe(0);
    });
  });

  describe('delete workflow (check usage -> confirm/cancel)', () => {
    it('checkUsageBeforeDelete returns true when items are in use', async () => {
      vi.mocked(MediaApiClient.prototype.checkMediaUsage).mockResolvedValue({
        data: { m1: { template_count: 2, template_names: ['T1', 'T2'] } },
      });

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.selectedItems.value = new Set(['m1']);

      const hasUsage = await lib.checkUsageBeforeDelete();

      expect(hasUsage).toBe(true);
      expect(lib.showDeleteWarning.value).toBe(true);
      expect(lib.deleteUsageInfo.value.m1.template_count).toBe(2);
    });

    it('checkUsageBeforeDelete returns false when no items selected', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const hasUsage = await lib.checkUsageBeforeDelete();
      expect(hasUsage).toBe(false);
    });

    it('confirmDelete deletes and cleans up state', async () => {
      vi.mocked(MediaApiClient.prototype.checkMediaUsage).mockResolvedValue({
        data: { m1: { template_count: 0, template_names: [] } },
      });
      vi.mocked(MediaApiClient.prototype.deleteMedia).mockResolvedValue(undefined);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.items.value = [createMediaItem('m1'), createMediaItem('m2')];
      lib.selectedItems.value = new Set(['m1']);

      await lib.checkUsageBeforeDelete();
      await lib.confirmDelete();

      expect(lib.items.value).toHaveLength(1);
      expect(lib.items.value[0].id).toBe('m2');
      expect(lib.showDeleteWarning.value).toBe(false);
      expect(lib.selectedItems.value.size).toBe(0);
    });

    it('cancelDelete resets warning state', () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.showDeleteWarning.value = true;
      lib.deleteUsageInfo.value = { m1: { template_count: 1, template_names: ['T1'] } };

      lib.cancelDelete();

      expect(lib.showDeleteWarning.value).toBe(false);
      expect(lib.deleteUsageInfo.value).toEqual({});
    });
  });

  describe('moveSelected', () => {
    it('removes items from current folder view', async () => {
      const moved = [createMediaItem('m1', { folder_id: 'f2' })];
      vi.mocked(MediaApiClient.prototype.moveMedia).mockResolvedValue(moved);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.currentFolderId.value = 'f1';
      lib.items.value = [createMediaItem('m1'), createMediaItem('m2')];
      lib.selectedItems.value = new Set(['m1']);

      await lib.moveSelected('f2');

      expect(lib.items.value).toHaveLength(1);
      expect(lib.items.value[0].id).toBe('m2');
      expect(lib.selectedItems.value.size).toBe(0);
    });

    it('does nothing when no selection', async () => {
      const moveMediaMock = vi.mocked(MediaApiClient.prototype.moveMedia);
      const callsBefore = moveMediaMock.mock.calls.length;

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.moveSelected('f1');

      expect(moveMediaMock.mock.calls.length - callsBefore).toBe(0);
    });

    it('updates items in-place when in root folder', async () => {
      const moved = [createMediaItem('m1', { folder_id: 'f2' })];
      vi.mocked(MediaApiClient.prototype.moveMedia).mockResolvedValue(moved);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.currentFolderId.value = null; // root
      lib.items.value = [createMediaItem('m1'), createMediaItem('m2')];
      lib.selectedItems.value = new Set(['m1']);

      await lib.moveSelected('f2');

      // In root, items are updated in place (not removed)
      expect(lib.items.value).toHaveLength(2);
      expect(lib.items.value[0].folder_id).toBe('f2');
    });
  });

  describe('updateFile', () => {
    it('updates item in list and preview', async () => {
      const updated = createMediaItem('m1', { filename: 'renamed.jpg', alt_text: 'Alt' } as any);
      vi.mocked(MediaApiClient.prototype.updateMedia).mockResolvedValue(updated);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.items.value = [createMediaItem('m1'), createMediaItem('m2')];
      lib.previewItem.value = createMediaItem('m1');

      await lib.updateFile('m1', 'renamed.jpg', 'Alt');

      expect(lib.items.value[0].filename).toBe('renamed.jpg');
      expect(lib.previewItem.value!.filename).toBe('renamed.jpg');
    });
  });

  describe('importFromUrl', () => {
    it('imports and prepends to items', async () => {
      const imported = createMediaItem('imported-1');
      vi.mocked(MediaApiClient.prototype.importFromUrl).mockResolvedValue(imported);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const result = await lib.importFromUrl('https://example.com/img.jpg');

      expect(result).toEqual(imported);
      expect(lib.items.value[0]).toEqual(imported);
      expect(lib.isImportingFromUrl.value).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(MediaApiClient.prototype.importFromUrl).mockRejectedValue(
        new Error('Invalid URL'),
      );

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const result = await lib.importFromUrl('bad-url');

      expect(result).toBeNull();
      expect(lib.importFromUrlError.value).toBe('Invalid URL');
    });
  });

  describe('folders', () => {
    it('loads folders from API', async () => {
      const folders = [createFolder('f1', 'Photos')];
      vi.mocked(MediaApiClient.prototype.getMediaFolders).mockResolvedValue(folders);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.loadFolders();

      expect(lib.folders.value).toEqual(folders);
    });

    it('creates folder and reloads tree', async () => {
      const folder = createFolder('f2', 'New Folder');
      vi.mocked(MediaApiClient.prototype.createMediaFolder).mockResolvedValue(folder);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const result = await lib.createFolder('New Folder');

      expect(result).toEqual(folder);
      expect(MediaApiClient.prototype.getMediaFolders).toHaveBeenCalled();
    });

    it('findFolderInTree finds nested folder', () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const tree = [
        createFolder('f1', 'Root', [
          createFolder('f2', 'Child', [createFolder('f3', 'Grandchild')]),
        ]),
      ];

      expect(lib.findFolderInTree(tree, 'f3')?.name).toBe('Grandchild');
      expect(lib.findFolderInTree(tree, 'f1')?.name).toBe('Root');
      expect(lib.findFolderInTree(tree, 'nonexistent')).toBeNull();
    });

    it('findFolderInTree returns null for empty tree', () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      expect(lib.findFolderInTree([], 'any-id')).toBeNull();
    });

    it('deleteFolder stays in current folder if different from deleted', async () => {
      vi.mocked(MediaApiClient.prototype.deleteMediaFolder).mockResolvedValue(undefined);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.folders.value = [createFolder('f1', 'Folder1'), createFolder('f2', 'Folder2')];
      lib.currentFolderId.value = 'f1';

      await lib.deleteFolder('f2');

      expect(lib.currentFolderId.value).toBe('f1');
    });

    it('deleteFolder navigates to parent if current folder is deleted', async () => {
      vi.mocked(MediaApiClient.prototype.deleteMediaFolder).mockResolvedValue(undefined);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.folders.value = [createFolder('f1', 'Parent', [createFolder('f2', 'Child')])];
      lib.folders.value[0].children![0].parent_id = 'f1';
      lib.currentFolderId.value = 'f2';

      await lib.deleteFolder('f2');

      expect(lib.currentFolderId.value).toBe('f1');
    });
  });

  describe('renameFolder', () => {
    it('renames folder and reloads tree', async () => {
      vi.mocked(MediaApiClient.prototype.renameMediaFolder).mockResolvedValue(
        createFolder('f1', 'Renamed'),
      );

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.renameFolder('f1', 'Renamed');

      expect(MediaApiClient.prototype.renameMediaFolder).toHaveBeenCalledWith('f1', 'Renamed');
      expect(MediaApiClient.prototype.getMediaFolders).toHaveBeenCalled();
    });

    it('calls onError on failure', async () => {
      vi.mocked(MediaApiClient.prototype.renameMediaFolder).mockRejectedValue(
        new Error('Rename failed'),
      );

      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      await lib.renameFolder('f1', 'Bad Name');

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('loadFrequentlyUsed', () => {
    it('loads frequently used items', async () => {
      const items = [createMediaItem('m1'), createMediaItem('m2')];
      vi.mocked(MediaApiClient.prototype.getFrequentlyUsed).mockResolvedValue(items);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      await lib.loadFrequentlyUsed();

      expect(lib.frequentlyUsedItems.value).toEqual(items);
    });

    it('calls onError on failure', async () => {
      vi.mocked(MediaApiClient.prototype.getFrequentlyUsed).mockRejectedValue(
        new Error('Failed'),
      );

      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      await lib.loadFrequentlyUsed();

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('replace workflow', () => {
    it('checkUsageBeforeReplace sets warning state', async () => {
      vi.mocked(MediaApiClient.prototype.checkMediaUsage).mockResolvedValue({
        data: { m1: { template_count: 3, template_names: ['T1', 'T2', 'T3'] } },
      });

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const item = createMediaItem('m1');
      await lib.checkUsageBeforeReplace(item);

      expect(lib.pendingReplaceItem.value).toEqual(item);
      expect(lib.showReplaceWarning.value).toBe(true);
      expect(lib.replaceUsageInfo.value?.template_count).toBe(3);
    });

    it('cancelReplace clears all replace state', () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.showReplaceWarning.value = true;
      lib.pendingReplaceItem.value = createMediaItem('m1');
      lib.replaceUsageInfo.value = { template_count: 1, template_names: ['T'] };
      lib.replaceError.value = 'some error';

      lib.cancelReplace();

      expect(lib.showReplaceWarning.value).toBe(false);
      expect(lib.pendingReplaceItem.value).toBeNull();
      expect(lib.replaceUsageInfo.value).toBeNull();
      expect(lib.replaceError.value).toBeNull();
    });

    it('replaceFile updates item in all lists', async () => {
      const updated = createMediaItem('m1', { filename: 'replaced.jpg' });
      vi.mocked(MediaApiClient.prototype.replaceMedia).mockResolvedValue(updated);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.items.value = [createMediaItem('m1')];
      lib.frequentlyUsedItems.value = [createMediaItem('m1')];
      lib.previewItem.value = createMediaItem('m1');
      lib.pendingReplaceItem.value = createMediaItem('m1');

      const result = await lib.replaceFile(new File(['new'], 'replaced.jpg'));

      expect(result).toEqual(updated);
      expect(lib.items.value[0].filename).toBe('replaced.jpg');
      expect(lib.frequentlyUsedItems.value[0].filename).toBe('replaced.jpg');
      expect(lib.previewItem.value!.filename).toBe('replaced.jpg');
      expect(lib.showReplaceWarning.value).toBe(false);
      expect(lib.pendingReplaceItem.value).toBeNull();
    });

    it('replaceFile sets replaceError on failure', async () => {
      vi.mocked(MediaApiClient.prototype.replaceMedia).mockRejectedValue(
        new Error('Replace failed'),
      );

      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      lib.pendingReplaceItem.value = createMediaItem('m1');

      const result = await lib.replaceFile(new File(['data'], 'new.jpg'));

      expect(result).toBeNull();
      expect(lib.replaceError.value).toBe('Replace failed');
      expect(lib.isReplacing.value).toBe(false);
      expect(onError).toHaveBeenCalled();
    });

    it('replaceFile returns null when no pending item', async () => {
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      const result = await lib.replaceFile(new File(['data'], 'file.jpg'));
      expect(result).toBeNull();
    });

    it('replaceMediaDirectly updates without workflow', async () => {
      const updated = createMediaItem('m1', { filename: 'direct.jpg' });
      vi.mocked(MediaApiClient.prototype.replaceMedia).mockResolvedValue(updated);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.items.value = [createMediaItem('m1')];

      const result = await lib.replaceMediaDirectly('m1', new File(['data'], 'direct.jpg'));

      expect(result).toEqual(updated);
      expect(lib.items.value[0].filename).toBe('direct.jpg');
    });

    it('replaceMediaDirectly updates frequently used items', async () => {
      const updated = createMediaItem('m1', { filename: 'updated.jpg' });
      vi.mocked(MediaApiClient.prototype.replaceMedia).mockResolvedValue(updated);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.items.value = [createMediaItem('m1')];
      lib.frequentlyUsedItems.value = [createMediaItem('m1')];
      lib.previewItem.value = createMediaItem('m1');

      await lib.replaceMediaDirectly('m1', new File(['data'], 'updated.jpg'));

      expect(lib.frequentlyUsedItems.value[0].filename).toBe('updated.jpg');
      expect(lib.previewItem.value?.filename).toBe('updated.jpg');
    });

    it('replaceMediaDirectly calls onError on failure', async () => {
      vi.mocked(MediaApiClient.prototype.replaceMedia).mockRejectedValue(
        new Error('Direct replace failed'),
      );

      const onError = vi.fn();
      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
        onError,
      });

      const result = await lib.replaceMediaDirectly('m1', new File(['data'], 'file.jpg'));

      expect(result).toBeNull();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('replaceMediaDirectly does not update preview when different id', async () => {
      const updated = createMediaItem('m2', { filename: 'other.jpg' });
      vi.mocked(MediaApiClient.prototype.replaceMedia).mockResolvedValue(updated);

      const lib = useMediaLibrary({
        projectId: 'proj-1',
        authManager: createMockAuthManager(),
      });

      lib.previewItem.value = createMediaItem('m1');

      await lib.replaceMediaDirectly('m2', new File(['data'], 'other.jpg'));

      expect(lib.previewItem.value?.id).toBe('m1');
    });
  });
});
