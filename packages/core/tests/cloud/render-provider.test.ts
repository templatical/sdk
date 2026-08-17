import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCloudRenderProvider } from '../../src/cloud/render-provider';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';
import type { RenderPayload, TemplateContent } from '@templatical/types';

vi.mock('../../src/cloud/api');

/**
 * Cloud's renderer, shaped as a `RenderProvider` so it plugs into the same editor
 * seam a consumer's own backend would.
 *
 * Three things here are deliberately unlike a BYO provider and are what these
 * cases pin: every render saves first (the endpoint reads storage), `payload.fonts`
 * passes through on every plan, and `compileMjml` is absent because both other
 * methods are whole-pipeline calls.
 */

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

const EMPTY_CONTENT = { blocks: [], settings: {} } as unknown as TemplateContent;
const CUSTOM_FONT = { name: 'Custom', url: 'https://fonts.com/custom.css' };

function payload(overrides: Partial<RenderPayload> = {}): RenderPayload {
  return {
    content: EMPTY_CONTENT,
    fonts: { customFonts: [CUSTOM_FONT], defaultFallback: 'Georgia, serif' },
    ...overrides,
  };
}

function setup(
  overrides: {
    templateId?: string | null;
    save?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const save =
    overrides.save ?? vi.fn().mockResolvedValue({ id: 'tmpl-1', content: EMPTY_CONTENT });

  const provider = createCloudRenderProvider({
    authManager: createMockAuthManager(),
    getTemplateId: () =>
      overrides.templateId === undefined ? 'tmpl-1' : overrides.templateId,
    save,
  });

  return { provider, save };
}

describe('createCloudRenderProvider', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.exportTemplate).mockResolvedValue({
      html: '<html>rendered</html>',
      mjml: '<mjml>source</mjml>',
    });
  });

  describe('shape', () => {
    it('implements toMjml and toHtml but never compileMjml', () => {
      const { provider } = setup();
      expect(typeof provider.toMjml).toBe('function');
      expect(typeof provider.toHtml).toBe('function');
      expect(provider.compileMjml).toBeUndefined();
    });
  });

  describe('toMjml', () => {
    it('returns the endpoint MJML for the saved template', async () => {
      const { provider } = setup();
      await expect(provider.toMjml!(payload())).resolves.toBe('<mjml>source</mjml>');
      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: [CUSTOM_FONT],
        defaultFallback: 'Georgia, serif',
      });
    });

    it('saves before exporting, so the export is never a stale version', async () => {
      const order: string[] = [];
      const save = vi.fn().mockImplementation(async () => {
        order.push('save');
        return { id: 'tmpl-1', content: EMPTY_CONTENT };
      });
      vi.mocked(ApiClient.prototype.exportTemplate).mockImplementation(async () => {
        order.push('export');
        return { html: '<html>rendered</html>', mjml: '<mjml>source</mjml>' };
      });

      const { provider } = setup({ save });
      await provider.toMjml!(payload());

      expect(order).toEqual(['save', 'export']);
    });

    it('exports against the id the save returned', async () => {
      const save = vi
        .fn()
        .mockResolvedValue({ id: 'tmpl-fresh', content: EMPTY_CONTENT });
      const { provider } = setup({ save, templateId: 'tmpl-1' });

      await provider.toMjml!(payload());

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith(
        'tmpl-fresh',
        expect.anything(),
      );
    });

    it('rejects with a render-specific message when no template exists', async () => {
      const { provider, save } = setup({ templateId: null });

      await expect(provider.toMjml!(payload())).rejects.toThrow(
        'Cloud renders from the saved template',
      );
      expect(save).not.toHaveBeenCalled();
      expect(ApiClient.prototype.exportTemplate).not.toHaveBeenCalled();
    });

    it('propagates a failed save without exporting', async () => {
      const save = vi.fn().mockRejectedValue(new Error('save exploded'));
      const { provider } = setup({ save });

      await expect(provider.toMjml!(payload())).rejects.toThrow('save exploded');
      expect(ApiClient.prototype.exportTemplate).not.toHaveBeenCalled();
    });
  });

  describe('toHtml', () => {
    it('returns only the html half of the export result', async () => {
      const { provider } = setup();
      await expect(provider.toHtml!(payload())).resolves.toBe('<html>rendered</html>');
    });

    it('saves before exporting too', async () => {
      const { provider, save } = setup();
      await provider.toHtml!(payload());
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('rejects when no template exists', async () => {
      const { provider } = setup({ templateId: null });
      await expect(provider.toHtml!(payload())).rejects.toThrow(
        'Cloud renders from the saved template',
      );
    });
  });

  describe('fonts', () => {
    // Unconditional: gating fonts by plan would make the paid tier render less
    // than the free editor.
    it('forwards the payload fonts on every plan', async () => {
      const { provider } = setup();
      await provider.toMjml!(payload());
      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: [CUSTOM_FONT],
        defaultFallback: 'Georgia, serif',
      });
    });

    it('falls back to Arial when the payload carries no fonts at all', async () => {
      const { provider } = setup();
      await provider.toMjml!({ content: EMPTY_CONTENT });
      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: [],
        defaultFallback: 'Arial, sans-serif',
      });
    });
  });

  describe('payload.content is deliberately ignored', () => {
    it('never reaches the endpoint — the save immediately before is the source', async () => {
      const { provider } = setup();
      const tampered = {
        blocks: [{ id: 'x', type: 'html' }],
        settings: {},
      } as unknown as TemplateContent;

      await provider.toHtml!({ content: tampered });

      // Two args only: the id and the fonts. Trusting an echoed payload would let
      // a caller render content the server never stored.
      const call = vi.mocked(ApiClient.prototype.exportTemplate).mock.calls[0];
      expect(call).toHaveLength(2);
      expect(JSON.stringify(call)).not.toContain('"type":"html"');
    });
  });
});
