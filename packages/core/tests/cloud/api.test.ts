import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';

function createMockAuthManager(overrides: Partial<AuthManager> = {}): AuthManager {
  return {
    projectId: 'proj-1',
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    ...overrides,
  } as unknown as AuthManager;
}

function mockResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(status === 204 ? undefined : { data }),
  } as unknown as Response;
}

function mockErrorResponse(message: string, status = 422, errors?: Record<string, string[]>): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ message, errors }),
  } as unknown as Response;
}

describe('ApiClient', () => {
  let authManager: AuthManager;
  let api: ApiClient;

  beforeEach(() => {
    authManager = createMockAuthManager();
    api = new ApiClient(authManager);
  });

  describe('templates', () => {
    it('creates a template', async () => {
      const template = { id: 'tmpl-1', content: {} };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(template),
      );

      const result = await api.createTemplate({ blocks: [], settings: {} } as any);

      expect(result).toEqual(template);
      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/templates'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('gets a template by ID', async () => {
      const template = { id: 'tmpl-1' };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(template),
      );

      const result = await api.getTemplate('tmpl-1');

      expect(result).toEqual(template);
      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/templates/tmpl-1'),
        expect.any(Object),
      );
    });

    it('updates a template', async () => {
      const template = { id: 'tmpl-1', content: {} };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(template),
      );

      const result = await api.updateTemplate('tmpl-1', { blocks: [], settings: {} } as any);

      expect(result).toEqual(template);
      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/templates/tmpl-1'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('deletes a template', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(undefined, 204),
      );

      await api.deleteTemplate('tmpl-1');

      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/templates/tmpl-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('snapshots', () => {
    it('gets snapshots for a template', async () => {
      const snapshots = [{ id: 'snap-1' }];
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(snapshots),
      );

      const result = await api.getSnapshots('tmpl-1');

      expect(result).toEqual(snapshots);
      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/templates/tmpl-1/snapshots'),
        expect.any(Object),
      );
    });

    it('creates a snapshot', async () => {
      const snapshot = { id: 'snap-1' };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(snapshot),
      );

      const result = await api.createSnapshot('tmpl-1', { blocks: [], settings: {} } as any);

      expect(result).toEqual(snapshot);
      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/templates/tmpl-1/snapshots'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('restores a snapshot', async () => {
      const template = { id: 'tmpl-1' };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(template),
      );

      const result = await api.restoreSnapshot('tmpl-1', 'snap-1');

      expect(result).toEqual(template);
      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/snapshots/snap-1/restore'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('export and test email', () => {
    it('exports a template with fonts payload', async () => {
      const exportResult = { html: '<html>', mjml: '<mjml>' };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(exportResult),
      );

      const result = await api.exportTemplate('tmpl-1', {
        customFonts: [{ name: 'Custom', url: 'https://fonts.com/custom.css' }],
        defaultFallback: 'Arial',
      });

      expect(result).toEqual(exportResult);
      const callArgs = vi.mocked(authManager.authenticatedFetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.custom_fonts).toHaveLength(1);
      expect(body.default_fallback).toBe('Arial');
    });

    it('exports without fonts payload', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse({ html: '<html>', mjml: '<mjml>' }),
      );

      await api.exportTemplate('tmpl-1');

      const callArgs = vi.mocked(authManager.authenticatedFetch).mock.calls[0];
      expect(callArgs[1]!.body).toBeUndefined();
    });

    it('sends test email', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(undefined, 204),
      );

      await api.sendTestEmail('tmpl-1', {
        recipient: 'test@example.com',
        html: '<html>',
        allowed_emails: ['test@example.com'],
        signature: 'sig',
      });

      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/send-test-email'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('comments', () => {
    it('gets comments for a template', async () => {
      const comments = [{ id: 'c1', body: 'hello' }];
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(comments),
      );

      const result = await api.getComments('tmpl-1');
      expect(result).toEqual(comments);
    });

    it('creates a comment', async () => {
      const comment = { id: 'c1', body: 'hello' };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(comment),
      );

      const result = await api.createComment('tmpl-1', {
        body: 'hello',
        user_id: 'u1',
        user_name: 'User',
        user_signature: 'sig',
      });
      expect(result).toEqual(comment);
    });

    it('passes custom headers for comments', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse({ id: 'c1' }),
      );

      await api.createComment(
        'tmpl-1',
        { body: 'hi', user_id: 'u1', user_name: 'U', user_signature: 's' },
        { 'X-Socket-ID': 'socket-123' },
      );

      const callArgs = vi.mocked(authManager.authenticatedFetch).mock.calls[0];
      expect(callArgs[1]!.headers).toEqual(
        expect.objectContaining({ 'X-Socket-ID': 'socket-123' }),
      );
    });

    it('resolves a comment', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse({ id: 'c1', resolved_at: '2024-01-01' }),
      );

      const result = await api.resolveComment('tmpl-1', 'c1', {
        user_id: 'u1',
        user_name: 'U',
        user_signature: 's',
      });

      expect(result.resolved_at).toBe('2024-01-01');
      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/comments/c1/resolve'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('saved modules', () => {
    it('lists modules', async () => {
      const modules = [{ id: 'm1', name: 'Header' }];
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(modules),
      );

      const result = await api.listModules();
      expect(result).toEqual(modules);
    });

    it('lists modules with search', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse([]),
      );

      await api.listModules('header');

      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('?search=header'),
        expect.any(Object),
      );
    });

    it('creates a module', async () => {
      const mod = { id: 'm1', name: 'Footer', content: [] };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(mod),
      );

      const result = await api.createModule({ name: 'Footer', content: [] });
      expect(result).toEqual(mod);
    });

    it('updates a module', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse({ id: 'm1', name: 'Updated' }),
      );

      const result = await api.updateModule('m1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('deletes a module', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(undefined, 204),
      );

      await api.deleteModule('m1');

      expect(authManager.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/saved-modules/m1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('config', () => {
    it('fetches plan config', async () => {
      const config = { features: { comments: true } };
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockResponse(config),
      );

      const result = await api.fetchConfig();
      expect(result).toEqual(config);
    });
  });

  describe('error handling', () => {
    it('throws SdkError on non-OK response', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockErrorResponse('Not found', 404),
      );

      await expect(api.getTemplate('bad-id')).rejects.toThrow('Not found');
    });

    it('extracts first validation error', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockErrorResponse('Validation failed', 422, {
          name: ['Name is required', 'Name must be unique'],
        }),
      );

      await expect(api.createModule({ name: '', content: [] })).rejects.toThrow(
        'Name is required',
      );
    });

    it('falls back to message when no validation errors', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockErrorResponse('Server error', 500),
      );

      await expect(api.getTemplate('id')).rejects.toThrow('Server error');
    });

    it('handles non-JSON error response', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      } as unknown as Response);

      await expect(api.getTemplate('id')).rejects.toThrow('HTTP error 500');
    });
  });
});
