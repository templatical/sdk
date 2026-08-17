import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveExportFonts, useExport } from '../../src/cloud/export';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';

vi.mock('../../src/cloud/api');

const NO_FONTS = { customFonts: [], defaultFallback: 'Arial, sans-serif' };

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

describe('useExport', () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.exportTemplate).mockResolvedValue({
      html: '<html>rendered</html>',
      mjml: '<mjml>source</mjml>',
    });
  });

  describe('exportHtml', () => {
    it('returns html and mjml', async () => {
      const { exportHtml } = useExport({ authManager: createMockAuthManager() });

      const result = await exportHtml('tmpl-1', NO_FONTS);

      expect(result.html).toBe('<html>rendered</html>');
      expect(result.mjml).toBe('<mjml>source</mjml>');
    });

    // The fonts payload is now the caller's to assemble — `useExport` is a plain
    // API wrapper, so it forwards whatever it's handed and makes no decision of
    // its own. That is what moved the `custom_fonts` entitlement out of here and
    // into `createCloudRenderProvider`.
    it('forwards the fonts payload verbatim', async () => {
      const { exportHtml } = useExport({ authManager: createMockAuthManager() });
      const fonts = {
        customFonts: [{ name: 'Custom', url: 'https://fonts.com/custom.css' }],
        defaultFallback: 'Georgia, serif',
      };

      await exportHtml('tmpl-1', fonts);

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith(
        'tmpl-1',
        fonts,
      );
    });
  });

  describe('getMjmlSource', () => {
    it('returns only MJML string', async () => {
      const { getMjmlSource } = useExport({ authManager: createMockAuthManager() });

      const result = await getMjmlSource('tmpl-1', NO_FONTS);

      expect(result).toBe('<mjml>source</mjml>');
    });

    it('forwards the fonts payload verbatim', async () => {
      const { getMjmlSource } = useExport({ authManager: createMockAuthManager() });
      const fonts = { customFonts: [], defaultFallback: 'Helvetica, sans-serif' };

      await getMjmlSource('tmpl-1', fonts);

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith(
        'tmpl-1',
        fonts,
      );
    });
  });

  describe('edge cases', () => {
    it('handles API response without mjml field gracefully', async () => {
      vi.mocked(ApiClient.prototype.exportTemplate).mockResolvedValue({
        html: '<html>rendered</html>',
      } as any);

      const { exportHtml } = useExport({ authManager: createMockAuthManager() });

      const result = await exportHtml('tmpl-1', NO_FONTS);

      expect(result.html).toBe('<html>rendered</html>');
      expect(result.mjml).toBeUndefined();
    });
  });
});

describe('resolveExportFonts', () => {
  const fonts = [{ name: 'Custom', url: 'https://fonts.com/custom.css' }];

  // Unconditional since the `custom_fonts` entitlement was deleted: it gated
  // editor capability the free editor grants, so it only ever made the paid tier
  // render fewer fonts than the free one.
  it('includes custom fonts on every plan', () => {
    expect(
      resolveExportFonts({ customFonts: fonts, defaultFallback: 'Arial' }),
    ).toEqual({ customFonts: fonts, defaultFallback: 'Arial' });
  });

  it('falls back to Arial when no fonts config exists', () => {
    expect(resolveExportFonts(undefined)).toEqual({
      customFonts: [],
      defaultFallback: 'Arial, sans-serif',
    });
  });

  it('keeps an explicitly empty custom font list empty', () => {
    expect(
      resolveExportFonts({
        customFonts: [],
        defaultFallback: 'Helvetica, sans-serif',
      }),
    ).toEqual({ customFonts: [], defaultFallback: 'Helvetica, sans-serif' });
  });
});
