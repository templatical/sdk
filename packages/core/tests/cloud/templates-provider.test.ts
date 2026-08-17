import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createCloudTemplatesProvider } from '../../src/cloud/templates-provider';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import type { Template, TemplateContent } from '@templatical/types';

vi.mock('../../src/cloud/api');

/**
 * Cloud's storage adapter for the same save/load contract a consumer implements.
 * Rows pass straight through — this adapter only supplies auth and scoping — so
 * what these cases pin is the mapping, including the `name` key that Cloud's
 * backend does not store yet and must therefore travel only when set.
 */

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

const CONTENT = { blocks: [], settings: {} } as unknown as TemplateContent;
const STORED: Template = { id: 'tmpl-1', content: CONTENT };

function setup() {
  return createCloudTemplatesProvider(createMockAuthManager());
}

describe('createCloudTemplatesProvider', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.getTemplate).mockResolvedValue(STORED);
    vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(STORED);
    vi.mocked(ApiClient.prototype.updateTemplate).mockResolvedValue(STORED);
    vi.mocked(ApiClient.prototype.createVersion).mockClear();
    vi.mocked(ApiClient.prototype.createVersion).mockResolvedValue({
      id: 'ver-1',
      template_id: 'tmpl-1',
      content: CONTENT,
      is_autosave: true,
      created_at: '2026-08-16T10:00:00Z',
    });
  });

  describe('permissions', () => {
    it('enables all three methods — a Cloud session can always save', () => {
      const provider = setup();
      expect(typeof provider.load).toBe('function');
      expect(typeof provider.create).toBe('function');
      expect(typeof provider.save).toBe('function');
    });
  });

  describe('load', () => {
    it('reads through the templates.show endpoint', async () => {
      const provider = setup();
      await expect(provider.load('tmpl-1')).resolves.toEqual(STORED);
      expect(ApiClient.prototype.getTemplate).toHaveBeenCalledWith('tmpl-1');
    });

    it('propagates a failure rather than resolving to a blank template', async () => {
      vi.mocked(ApiClient.prototype.getTemplate).mockRejectedValue(
        new Error('404'),
      );
      await expect(setup().load('nope')).rejects.toThrow('404');
    });
  });

  describe('create', () => {
    it('sends content and returns the store-assigned template', async () => {
      const provider = setup();
      const result = await (provider.create as Exclude<
        typeof provider.create,
        false
      >)({ content: CONTENT });

      expect(result.id).toBe('tmpl-1');
      expect(ApiClient.prototype.createTemplate).toHaveBeenCalledWith(
        CONTENT,
        undefined,
      );
    });

    it('forwards a name when one is supplied', async () => {
      const provider = setup();
      await (provider.create as Exclude<typeof provider.create, false>)({
        name: 'Launch email',
        content: CONTENT,
      });

      expect(ApiClient.prototype.createTemplate).toHaveBeenCalledWith(
        CONTENT,
        'Launch email',
      );
    });
  });

  describe('save', () => {
    it('forwards the patch verbatim', async () => {
      const provider = setup();
      await (provider.save as Exclude<typeof provider.save, false>)('tmpl-1', {
        content: CONTENT,
      });

      expect(ApiClient.prototype.updateTemplate).toHaveBeenCalledWith('tmpl-1', {
        content: CONTENT,
      });
    });

    it('forwards a rename-only patch without content', async () => {
      const provider = setup();
      await (provider.save as Exclude<typeof provider.save, false>)('tmpl-1', {
        name: 'Renamed',
      });

      expect(ApiClient.prototype.updateTemplate).toHaveBeenCalledWith('tmpl-1', {
        name: 'Renamed',
      });
    });

    it('propagates a failure so nothing is reported as saved', async () => {
      vi.mocked(ApiClient.prototype.updateTemplate).mockRejectedValue(
        new Error('conflict'),
      );
      const provider = setup();
      await expect(
        (provider.save as Exclude<typeof provider.save, false>)('tmpl-1', {
          content: CONTENT,
        }),
      ).rejects.toThrow('conflict');
    });
  });

  /**
   * The contract puts automatic versions on whoever implements `save`, so this
   * is where Cloud's retention policy lives, keeping Cloud's storage cost out of
   * the editor.
   */
  describe('automatic versions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T10:00:00Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    async function save(provider: ReturnType<typeof setup>) {
      await (provider.save as Exclude<typeof provider.save, false>)('tmpl-1', {
        content: CONTENT,
      });
      // The version request is fire-and-forget, so let its microtask run.
      await Promise.resolve();
    }

    it('records one on the first content save of a session', async () => {
      const provider = setup();
      await save(provider);

      expect(ApiClient.prototype.createVersion).toHaveBeenCalledWith(
        'tmpl-1',
        CONTENT,
      );
    });

    it('throttles: a second save a few seconds later records nothing', async () => {
      const provider = setup();
      await save(provider);
      vi.setSystemTime(new Date('2026-08-16T10:00:05Z'));
      await save(provider);

      expect(ApiClient.prototype.createVersion).toHaveBeenCalledTimes(1);
      // The template itself is saved every time — only the version is throttled.
      expect(ApiClient.prototype.updateTemplate).toHaveBeenCalledTimes(2);
    });

    it('records again once the interval has passed', async () => {
      const provider = setup();
      await save(provider);
      vi.setSystemTime(new Date('2026-08-16T10:01:30Z'));
      await save(provider);

      expect(ApiClient.prototype.createVersion).toHaveBeenCalledTimes(2);
    });

    it('records nothing for a rename-only patch', async () => {
      const provider = setup();
      await (provider.save as Exclude<typeof provider.save, false>)('tmpl-1', {
        name: 'Renamed',
      });
      await Promise.resolve();

      expect(ApiClient.prototype.createVersion).not.toHaveBeenCalled();
    });

    it('resolves the save even when the version endpoint fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(ApiClient.prototype.createVersion).mockRejectedValue(
        new Error('history unavailable'),
      );
      const provider = setup();

      await expect(
        (provider.save as Exclude<typeof provider.save, false>)('tmpl-1', {
          content: CONTENT,
        }),
      ).resolves.toEqual(STORED);
      warn.mockRestore();
    });

    it('logs the failed version write rather than swallowing it', async () => {
      // Not fatal — the save succeeded — but history quietly not filling up is
      // exactly the failure nobody notices until they need a version that was
      // never recorded.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const failure = new Error('history unavailable');
      vi.mocked(ApiClient.prototype.createVersion).mockRejectedValue(failure);
      const provider = setup();

      await (provider.save as Exclude<typeof provider.save, false>)('tmpl-1', {
        content: CONTENT,
      });
      // The rejection is handled a microtask after the save resolves.
      await Promise.resolve();
      await Promise.resolve();

      expect(warn).toHaveBeenCalledWith(
        '[Templatical] Automatic version not recorded — the save itself succeeded:',
        failure,
      );
      warn.mockRestore();
    });
  });
});
