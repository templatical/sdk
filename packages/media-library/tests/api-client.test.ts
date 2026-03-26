import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MediaApiClient } from '../src/api-client';
import type { AuthManager } from '@templatical/core/cloud';

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

function mockJsonResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(status === 204 ? undefined : { data }),
  } as unknown as Response;
}

function mockBrowseResponse(items: unknown[] = [], nextCursor: string | null = null): Response {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        data: items,
        meta: { path: '/media', per_page: 20, next_cursor: nextCursor, prev_cursor: null },
      }),
  } as unknown as Response;
}

function mockErrorResponse(message: string, status = 422): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  } as unknown as Response;
}

describe('MediaApiClient', () => {
  let auth: AuthManager;
  let api: MediaApiClient;

  beforeEach(() => {
    auth = createMockAuthManager();
    api = new MediaApiClient(auth);
  });

  describe('browseMedia', () => {
    it('fetches media with no params', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockBrowseResponse());

      const result = await api.browseMedia({});

      expect(auth.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/media/browse'),
        expect.objectContaining({ headers: { Accept: 'application/json' } }),
      );
      expect(result.data).toEqual([]);
    });

    it('builds query string from params', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockBrowseResponse());

      await api.browseMedia({
        folder_id: 'f1',
        search: 'logo',
        category: 'images',
        sort: 'name_asc',
        cursor: 'abc123',
      });

      const url = vi.mocked(auth.authenticatedFetch).mock.calls[0][0];
      expect(url).toContain('folder_id=f1');
      expect(url).toContain('search=logo');
      expect(url).toContain('category=images');
      expect(url).toContain('sort=name_asc');
      expect(url).toContain('cursor=abc123');
    });

    it('omits undefined params from query string', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockBrowseResponse());

      await api.browseMedia({ folder_id: 'f1' });

      const url = vi.mocked(auth.authenticatedFetch).mock.calls[0][0];
      expect(url).toContain('folder_id=f1');
      expect(url).not.toContain('search=');
      expect(url).not.toContain('category=');
    });

    it('throws on error response', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockErrorResponse('Forbidden', 403));

      await expect(api.browseMedia({})).rejects.toThrow('Forbidden');
    });
  });

  describe('uploadMedia', () => {
    it('uploads file with FormData', async () => {
      const mediaItem = { id: 'm1', filename: 'photo.jpg' };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(mediaItem));

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await api.uploadMedia(file);

      expect(result).toEqual(mediaItem);
      const callArgs = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(callArgs[1]!.method).toBe('POST');
      expect(callArgs[1]!.body).toBeInstanceOf(FormData);
    });

    it('includes folder_id in FormData when provided', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockJsonResponse({ id: 'm1' }),
      );

      const file = new File(['data'], 'photo.jpg');
      await api.uploadMedia(file, 'folder-1');

      const formData = vi.mocked(auth.authenticatedFetch).mock.calls[0][1]!.body as FormData;
      expect(formData.get('folder_id')).toBe('folder-1');
    });

    it('throws on upload error', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockErrorResponse('File too large', 413),
      );

      const file = new File(['data'], 'big.zip');
      await expect(api.uploadMedia(file)).rejects.toThrow('File too large');
    });
  });

  describe('updateMedia', () => {
    it('updates filename and alt text', async () => {
      const updated = { id: 'm1', filename: 'renamed.jpg', alt_text: 'A photo' };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(updated));

      const result = await api.updateMedia('m1', 'renamed.jpg', 'A photo');

      expect(result).toEqual(updated);
      const callArgs = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(callArgs[1]!.method).toBe('PUT');
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.filename).toBe('renamed.jpg');
      expect(body.alt_text).toBe('A photo');
    });
  });

  describe('deleteMedia', () => {
    it('sends IDs in request body', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(undefined, 204));

      await api.deleteMedia(['m1', 'm2']);

      const callArgs = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(callArgs[1]!.method).toBe('POST');
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.ids).toEqual(['m1', 'm2']);
    });
  });

  describe('moveMedia', () => {
    it('moves items to a folder', async () => {
      const moved = [{ id: 'm1', folder_id: 'f2' }];
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(moved));

      const result = await api.moveMedia(['m1'], 'f2');

      expect(result).toEqual(moved);
      const body = JSON.parse(
        vi.mocked(auth.authenticatedFetch).mock.calls[0][1]!.body as string,
      );
      expect(body.ids).toEqual(['m1']);
      expect(body.folder_id).toBe('f2');
    });

    it('moves items to root (null folder)', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse([]));

      await api.moveMedia(['m1'], null);

      const body = JSON.parse(
        vi.mocked(auth.authenticatedFetch).mock.calls[0][1]!.body as string,
      );
      expect(body.folder_id).toBeNull();
    });
  });

  describe('folders', () => {
    it('gets folders', async () => {
      const folders = [{ id: 'f1', name: 'Photos' }];
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(folders));

      const result = await api.getMediaFolders();
      expect(result).toEqual(folders);
    });

    it('creates a folder with parent', async () => {
      const folder = { id: 'f2', name: 'Sub', parent_id: 'f1' };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(folder));

      const result = await api.createMediaFolder('Sub', 'f1');

      expect(result).toEqual(folder);
      const body = JSON.parse(
        vi.mocked(auth.authenticatedFetch).mock.calls[0][1]!.body as string,
      );
      expect(body.name).toBe('Sub');
      expect(body.parent_id).toBe('f1');
    });

    it('creates a root folder (null parent)', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockJsonResponse({ id: 'f1', name: 'Root' }),
      );

      await api.createMediaFolder('Root');

      const body = JSON.parse(
        vi.mocked(auth.authenticatedFetch).mock.calls[0][1]!.body as string,
      );
      expect(body.parent_id).toBeNull();
    });

    it('renames a folder', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockJsonResponse({ id: 'f1', name: 'Renamed' }),
      );

      const result = await api.renameMediaFolder('f1', 'Renamed');

      expect(result.name).toBe('Renamed');
      expect(auth.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('f1'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('deletes a folder', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(undefined, 204));

      await api.deleteMediaFolder('f1');

      expect(auth.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('f1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('checkMediaUsage', () => {
    it('returns usage data', async () => {
      const usageResponse = {
        data: { m1: { template_count: 3, template_names: ['T1', 'T2', 'T3'] } },
      };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(usageResponse),
      } as unknown as Response);

      const result = await api.checkMediaUsage(['m1']);

      expect(result.data.m1.template_count).toBe(3);
    });

    it('throws on error', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockErrorResponse('Server error', 500),
      );

      await expect(api.checkMediaUsage(['m1'])).rejects.toThrow('Server error');
    });
  });

  describe('getFrequentlyUsed', () => {
    it('returns frequently used items', async () => {
      const items = [{ id: 'm1' }, { id: 'm2' }];
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(items));

      const result = await api.getFrequentlyUsed();
      expect(result).toEqual(items);
    });
  });

  describe('importFromUrl', () => {
    it('imports media from URL', async () => {
      const media = { id: 'm1', filename: 'image.jpg' };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(media));

      const result = await api.importFromUrl('https://example.com/image.jpg', 'f1');

      expect(result).toEqual(media);
      const body = JSON.parse(
        vi.mocked(auth.authenticatedFetch).mock.calls[0][1]!.body as string,
      );
      expect(body.url).toBe('https://example.com/image.jpg');
      expect(body.folder_id).toBe('f1');
    });

    it('defaults folder_id to null', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockJsonResponse({ id: 'm1' }),
      );

      await api.importFromUrl('https://example.com/image.jpg');

      const body = JSON.parse(
        vi.mocked(auth.authenticatedFetch).mock.calls[0][1]!.body as string,
      );
      expect(body.folder_id).toBeNull();
    });
  });

  describe('replaceMedia', () => {
    it('replaces media file with FormData', async () => {
      const updated = { id: 'm1', filename: 'new.jpg' };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJsonResponse(updated));

      const file = new File(['new-data'], 'new.jpg', { type: 'image/jpeg' });
      const result = await api.replaceMedia('m1', file);

      expect(result).toEqual(updated);
      const callArgs = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(callArgs[0]).toContain('m1');
      expect(callArgs[1]!.method).toBe('POST');
      expect(callArgs[1]!.body).toBeInstanceOf(FormData);
    });
  });

  describe('error handling', () => {
    it('handles non-JSON error response', async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      } as unknown as Response);

      await expect(api.updateMedia('m1', 'test.jpg')).rejects.toThrow('HTTP error 500');
    });
  });
});
