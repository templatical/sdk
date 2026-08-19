import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCloudVersionHistoryProvider } from '../../src/cloud/version-history-provider';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import type { TemplateContent, TemplateVersionResponse } from '@templatical/types';

vi.mock('../../src/cloud/api');

/**
 * Cloud's adapter for the same version-history contract a consumer implements.
 *
 * The only real work it does is mapping Cloud's wire shape (snake_case,
 * `is_autosave`) onto the contract's, so that is what these cases pin —
 * including the `content` hint, which is what keeps scrubbing synchronous for a
 * Cloud session and is easy to drop by accident when mapping fields by hand.
 */

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

const CONTENT = {
  blocks: [{ id: 'b1', type: 'paragraph' }],
  settings: {},
} as unknown as TemplateContent;

function record(
  overrides: Partial<TemplateVersionResponse> = {},
): TemplateVersionResponse {
  return {
    id: 'ver-1',
    template_id: 'tmpl-1',
    content: CONTENT,
    is_autosave: true,
    created_at: '2026-08-16T10:00:00Z',
    ...overrides,
  };
}

function setup() {
  return createCloudVersionHistoryProvider(createMockAuthManager());
}

describe('createCloudVersionHistoryProvider', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.getVersions).mockClear();
    vi.mocked(ApiClient.prototype.getVersion).mockClear();
    vi.mocked(ApiClient.prototype.createVersion).mockClear();
    vi.mocked(ApiClient.prototype.restoreVersion).mockClear();
  });

  describe('permissions', () => {
    it('enables both mutations — version storage is what the plan pays for', () => {
      const provider = setup();
      expect(typeof provider.list).toBe('function');
      expect(typeof provider.get).toBe('function');
      expect(typeof provider.create).toBe('function');
      expect(typeof provider.restore).toBe('function');
    });
  });

  describe('list', () => {
    it('maps the wire shape onto the contract, hint included', async () => {
      vi.mocked(ApiClient.prototype.getVersions).mockResolvedValue([
        record({ id: 'ver-2', is_autosave: false }),
        record({ id: 'ver-1' }),
      ]);

      const { versions } = await setup().list('tmpl-1');

      expect(versions).toEqual([
        {
          id: 'ver-2',
          createdAt: '2026-08-16T10:00:00Z',
          isAutomatic: false,
          content: CONTENT,
        },
        {
          id: 'ver-1',
          createdAt: '2026-08-16T10:00:00Z',
          isAutomatic: true,
          content: CONTENT,
        },
      ]);
      expect(ApiClient.prototype.getVersions).toHaveBeenCalledWith('tmpl-1');
    });

    it('keeps the endpoint order rather than sorting', async () => {
      vi.mocked(ApiClient.prototype.getVersions).mockResolvedValue([
        record({ id: 'a', created_at: '2026-01-01T00:00:00Z' }),
        record({ id: 'b', created_at: '2026-09-09T00:00:00Z' }),
      ]);

      const { versions } = await setup().list('tmpl-1');
      expect(versions.map((v) => v.id)).toEqual(['a', 'b']);
    });
  });

  describe('get', () => {
    it('unwraps the record to its content', async () => {
      vi.mocked(ApiClient.prototype.getVersion).mockResolvedValue(record());

      await expect(setup().get('tmpl-1', 'ver-1')).resolves.toEqual(CONTENT);
      expect(ApiClient.prototype.getVersion).toHaveBeenCalledWith(
        'tmpl-1',
        'ver-1',
      );
    });
  });

  describe('create', () => {
    it('forwards the label and maps the result back', async () => {
      vi.mocked(ApiClient.prototype.createVersion).mockResolvedValue(
        record({ id: 'ver-9', is_autosave: false }),
      );

      const created = await (setup().create as Exclude<
        ReturnType<typeof setup>['create'],
        false
      >)('tmpl-1', CONTENT, { label: 'Before launch' });

      expect(created).toEqual({
        id: 'ver-9',
        createdAt: '2026-08-16T10:00:00Z',
        isAutomatic: false,
        content: CONTENT,
      });
      expect(ApiClient.prototype.createVersion).toHaveBeenCalledWith(
        'tmpl-1',
        CONTENT,
        'Before launch',
      );
    });
  });

  describe('restore', () => {
    it('returns the template the endpoint produced', async () => {
      vi.mocked(ApiClient.prototype.restoreVersion).mockResolvedValue({
        id: 'tmpl-1',
        content: CONTENT,
      });

      const template = await (setup().restore as Exclude<
        ReturnType<typeof setup>['restore'],
        false
      >)('tmpl-1', 'ver-1');

      expect(template.id).toBe('tmpl-1');
      expect(ApiClient.prototype.restoreVersion).toHaveBeenCalledWith(
        'tmpl-1',
        'ver-1',
      );
    });
  });
});
