import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useTestEmail } from '../../src/cloud/test-email';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import { ref } from 'vue';

vi.mock('../../src/cloud/api');

function createMockAuthManager(
  testEmailConfig: { allowedEmails: string[]; signature: string } | null = {
    allowedEmails: ['test@example.com'],
    signature: 'sig-123',
  },
): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    testEmailConfig,
  } as unknown as AuthManager;
}

describe('useTestEmail', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.sendTestEmail).mockResolvedValue(undefined);
  });

  it('isEnabled reflects testEmailConfig availability', () => {
    const isAuthReady = ref(true);
    const { isEnabled } = useTestEmail({
      authManager: createMockAuthManager(),
      getTemplateId: () => 'tmpl-1',
      save: vi.fn(),
      exportHtml: vi.fn(),
      isAuthReady,
    });

    expect(isEnabled.value).toBe(true);
  });

  it('isEnabled is false when no testEmailConfig', () => {
    const isAuthReady = ref(true);
    const { isEnabled } = useTestEmail({
      authManager: createMockAuthManager(null),
      getTemplateId: () => 'tmpl-1',
      save: vi.fn(),
      exportHtml: vi.fn(),
      isAuthReady,
    });

    expect(isEnabled.value).toBe(false);
  });

  it('allowedEmails returns emails from config', () => {
    const isAuthReady = ref(true);
    const { allowedEmails } = useTestEmail({
      authManager: createMockAuthManager(),
      getTemplateId: () => 'tmpl-1',
      save: vi.fn(),
      exportHtml: vi.fn(),
      isAuthReady,
    });

    expect(allowedEmails.value).toEqual(['test@example.com']);
  });

  it('allowedEmails is empty when config is null', () => {
    const isAuthReady = ref(true);
    const { allowedEmails } = useTestEmail({
      authManager: createMockAuthManager(null),
      getTemplateId: () => 'tmpl-1',
      save: vi.fn(),
      exportHtml: vi.fn(),
      isAuthReady,
    });

    expect(allowedEmails.value).toEqual([]);
  });

  describe('sendTestEmail', () => {
    it('saves, exports, and sends', async () => {
      const isAuthReady = ref(true);
      const save = vi.fn().mockResolvedValue({ id: 'tmpl-1' });
      const exportHtml = vi.fn().mockResolvedValue({
        html: '<html>test</html>',
        mjml: '<mjml>',
      });

      const { sendTestEmail } = useTestEmail({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        save,
        exportHtml,
        isAuthReady,
      });

      await sendTestEmail('user@test.com');

      expect(save).toHaveBeenCalled();
      expect(exportHtml).toHaveBeenCalledWith('tmpl-1');
      expect(ApiClient.prototype.sendTestEmail).toHaveBeenCalledWith('tmpl-1', {
        recipient: 'user@test.com',
        html: '<html>test</html>',
        allowed_emails: ['test@example.com'],
        signature: 'sig-123',
      });
    });

    it('applies onBeforeTestEmail hook', async () => {
      const isAuthReady = ref(true);
      const { sendTestEmail } = useTestEmail({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        save: vi.fn().mockResolvedValue({}),
        exportHtml: vi.fn().mockResolvedValue({ html: '<html>original</html>', mjml: '' }),
        isAuthReady,
        onBeforeTestEmail: (html) => html.replace('original', 'modified'),
      });

      await sendTestEmail('user@test.com');

      expect(ApiClient.prototype.sendTestEmail).toHaveBeenCalledWith(
        'tmpl-1',
        expect.objectContaining({ html: '<html>modified</html>' }),
      );
    });

    it('throws when testEmailConfig is null', async () => {
      const isAuthReady = ref(true);
      const { sendTestEmail } = useTestEmail({
        authManager: createMockAuthManager(null),
        getTemplateId: () => 'tmpl-1',
        save: vi.fn(),
        exportHtml: vi.fn(),
        isAuthReady,
      });

      await expect(sendTestEmail('user@test.com')).rejects.toThrow(
        'Test email is not enabled',
      );
    });

    it('throws when no template ID', async () => {
      const isAuthReady = ref(true);
      const { sendTestEmail } = useTestEmail({
        authManager: createMockAuthManager(),
        getTemplateId: () => null,
        save: vi.fn(),
        exportHtml: vi.fn(),
        isAuthReady,
      });

      await expect(sendTestEmail('user@test.com')).rejects.toThrow(
        'Template must be saved',
      );
    });

    it('manages isSending state', async () => {
      const isAuthReady = ref(true);
      const { isSending, sendTestEmail } = useTestEmail({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        save: vi.fn().mockResolvedValue({}),
        exportHtml: vi.fn().mockResolvedValue({ html: '', mjml: '' }),
        isAuthReady,
      });

      expect(isSending.value).toBe(false);
      const promise = sendTestEmail('user@test.com');
      expect(isSending.value).toBe(true);

      await promise;
      expect(isSending.value).toBe(false);
    });

    it('sets error and calls onError on failure', async () => {
      const isAuthReady = ref(true);
      const onError = vi.fn();
      const { error, sendTestEmail } = useTestEmail({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        save: vi.fn().mockRejectedValue(new Error('Save failed')),
        exportHtml: vi.fn(),
        isAuthReady,
        onError,
      });

      await expect(sendTestEmail('user@test.com')).rejects.toThrow('Save failed');

      expect(error.value).toBe('Save failed');
      expect(onError).toHaveBeenCalled();
    });

    it('resets isSending after error', async () => {
      const isAuthReady = ref(true);
      const { isSending, sendTestEmail } = useTestEmail({
        authManager: createMockAuthManager(),
        getTemplateId: () => 'tmpl-1',
        save: vi.fn().mockRejectedValue(new Error('fail')),
        exportHtml: vi.fn(),
        isAuthReady,
      });

      await sendTestEmail('user@test.com').catch(() => {});
      expect(isSending.value).toBe(false);
    });
  });
});
