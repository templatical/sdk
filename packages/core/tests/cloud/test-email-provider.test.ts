import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computed, ref } from 'vue';
import { createCloudTestEmailProvider } from '../../src/cloud/test-email-provider';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import type { TemplateContent } from '@templatical/types';

vi.mock('../../src/cloud/api');

/**
 * Cloud's sending adapter, shaped as a `TestEmailProvider` so it plugs into the
 * same editor seam a consumer's own sender would.
 *
 * These cases pin the five behaviours that had to survive the migration off the
 * Cloud-only `useTestEmail.sendTestEmail`: the identity error, save-before-send,
 * the `onBeforeTestEmail` transform reaching the API, the signed allowlist being
 * forwarded, and the allowlist staying reactive.
 */

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

const EMPTY_CONTENT = { blocks: [], settings: {} } as unknown as TemplateContent;

function setup(
  overrides: {
    templateId?: string | null;
    signature?: string | null;
    allowed?: string[];
    save?: ReturnType<typeof vi.fn>;
    exportHtml?: ReturnType<typeof vi.fn>;
    onBeforeTestEmail?: (html: string) => string | Promise<string>;
  } = {},
) {
  const save = overrides.save ?? vi.fn().mockResolvedValue({ id: 'tmpl-1' });
  const exportHtml =
    overrides.exportHtml ??
    vi.fn().mockResolvedValue({ html: '<html>test</html>', mjml: '<mjml>' });
  const allowedEmails = ref(overrides.allowed ?? ['test@example.com']);

  const provider = createCloudTestEmailProvider({
    authManager: createMockAuthManager(),
    getTemplateId: () =>
      overrides.templateId === undefined ? 'tmpl-1' : overrides.templateId,
    save,
    exportHtml,
    allowedEmails: computed(() => allowedEmails.value),
    getSignature: () =>
      overrides.signature === undefined ? 'sig-123' : overrides.signature,
    onBeforeTestEmail: overrides.onBeforeTestEmail,
  });

  return { provider, save, exportHtml, allowedEmails };
}

function send(
  provider: ReturnType<typeof setup>['provider'],
  recipient = 'user@test.com',
) {
  return provider.send({ recipient, content: EMPTY_CONTENT });
}

describe('createCloudTestEmailProvider', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.sendTestEmail).mockClear();
    vi.mocked(ApiClient.prototype.sendTestEmail).mockResolvedValue(undefined);
  });

  it('saves, exports, and posts the rendered HTML with the signed allowlist', async () => {
    const { provider, save, exportHtml } = setup();

    await send(provider);

    expect(save).toHaveBeenCalledTimes(1);
    expect(exportHtml).toHaveBeenCalledWith('tmpl-1');
    expect(ApiClient.prototype.sendTestEmail).toHaveBeenCalledWith('tmpl-1', {
      recipient: 'user@test.com',
      html: '<html>test</html>',
      allowed_emails: ['test@example.com'],
      signature: 'sig-123',
    });
  });

  it('saves BEFORE exporting — the backend renders from the stored template', async () => {
    const order: string[] = [];
    const save = vi.fn(async () => {
      order.push('save');
      return { id: 'tmpl-1' };
    });
    const exportHtml = vi.fn(async () => {
      order.push('export');
      return { html: '', mjml: '' };
    });

    await send(setup({ save, exportHtml }).provider);

    expect(order).toEqual(['save', 'export']);
  });

  it('posts the onBeforeTestEmail-transformed HTML, not the original', async () => {
    const { provider } = setup({
      exportHtml: vi
        .fn()
        .mockResolvedValue({ html: '<html>original</html>', mjml: '' }),
      onBeforeTestEmail: (html) => html.replace('original', 'modified'),
    });

    await send(provider);

    expect(ApiClient.prototype.sendTestEmail).toHaveBeenCalledWith(
      'tmpl-1',
      expect.objectContaining({ html: '<html>modified</html>' }),
    );
  });

  it('honours an onBeforeTestEmail hook that returns an empty string', async () => {
    const { provider } = setup({
      exportHtml: vi
        .fn()
        .mockResolvedValue({ html: '<html>original</html>', mjml: '' }),
      onBeforeTestEmail: () => '',
    });

    await send(provider);

    expect(ApiClient.prototype.sendTestEmail).toHaveBeenCalledWith(
      'tmpl-1',
      expect.objectContaining({ html: '' }),
    );
  });

  it('rejects when the project has no test-email signature', async () => {
    const { provider, save } = setup({ signature: null });

    await expect(send(provider)).rejects.toThrow(
      'Test email is not enabled',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects when no template has been saved yet', async () => {
    const { provider, save } = setup({ templateId: null });

    await expect(send(provider)).rejects.toThrow('Template must be saved');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not export or post when save rejects', async () => {
    const { provider, exportHtml } = setup({
      save: vi.fn().mockRejectedValue(new Error('Save failed')),
    });

    await expect(send(provider)).rejects.toThrow('Save failed');
    expect(exportHtml).not.toHaveBeenCalled();
    expect(ApiClient.prototype.sendTestEmail).not.toHaveBeenCalled();
  });

  describe('allowedRecipients is a live getter, not a snapshot', () => {
    it('reflects a list that fills after construction', () => {
      const { provider, allowedEmails } = setup({ allowed: [] });

      // Pre-auth: empty. The editor reads this as "nobody may be sent to" and
      // hides the trigger, which is why a snapshot here would hide it forever.
      expect(provider.allowedRecipients).toEqual([]);

      allowedEmails.value = ['qa@example.com', 'ops@example.com'];

      expect(provider.allowedRecipients).toEqual([
        'qa@example.com',
        'ops@example.com',
      ]);
    });

    it('posts the list as it stands at send time', async () => {
      const { provider, allowedEmails } = setup({ allowed: [] });
      allowedEmails.value = ['late@example.com'];

      await send(provider, 'late@example.com');

      expect(ApiClient.prototype.sendTestEmail).toHaveBeenCalledWith(
        'tmpl-1',
        expect.objectContaining({ allowed_emails: ['late@example.com'] }),
      );
    });
  });

  it('ignores the payload content and echoed allowlist', async () => {
    // Cloud renders server-side from the saved template and derives the allowlist
    // from the signed JWT. Trusting the echoed payload would swap a server-signed
    // list for an unsigned browser value.
    const { provider, exportHtml } = setup();

    await provider.send({
      recipient: 'user@test.com',
      content: { blocks: [{ id: 'x' }], settings: {} } as unknown as TemplateContent,
      allowedRecipients: ['attacker@evil.test'],
    });

    expect(exportHtml).toHaveBeenCalledWith('tmpl-1');
    expect(ApiClient.prototype.sendTestEmail).toHaveBeenCalledWith(
      'tmpl-1',
      expect.objectContaining({ allowed_emails: ['test@example.com'] }),
    );
  });

  it('never opts into includeMjml — Cloud renders server-side', () => {
    expect(setup().provider.includeMjml).toBeUndefined();
  });
});
