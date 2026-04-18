import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useExport } from '../../src/cloud/export';
import { ApiClient } from '../../src/cloud/api';
import type { AuthManager } from '../../src/cloud/auth';

vi.mock('../../src/cloud/api');

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

      const result = await exportHtml('tmpl-1');

      expect(result.html).toBe('<html>rendered</html>');
      expect(result.mjml).toBe('<mjml>source</mjml>');
    });

    it('passes fonts payload to API', async () => {
      const { exportHtml } = useExport({
        authManager: createMockAuthManager(),
        getFontsConfig: () => ({
          customFonts: [{ name: 'Custom', url: 'https://fonts.com/custom.css' }],
          defaultFallback: 'Georgia, serif',
        }),
      });

      await exportHtml('tmpl-1');

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: [{ name: 'Custom', url: 'https://fonts.com/custom.css' }],
        defaultFallback: 'Georgia, serif',
      });
    });

    it('uses default fallback when fonts config is undefined', async () => {
      const { exportHtml } = useExport({
        authManager: createMockAuthManager(),
        getFontsConfig: () => undefined,
      });

      await exportHtml('tmpl-1');

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: [],
        defaultFallback: 'Arial, sans-serif',
      });
    });

    it('excludes custom fonts when not allowed', async () => {
      const { exportHtml } = useExport({
        authManager: createMockAuthManager(),
        getFontsConfig: () => ({
          customFonts: [{ name: 'Custom', url: 'https://fonts.com/custom.css' }],
          defaultFallback: 'Georgia',
        }),
        canUseCustomFonts: () => false,
      });

      await exportHtml('tmpl-1');

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: [],
        defaultFallback: 'Georgia',
      });
    });

    it('includes custom fonts when allowed', async () => {
      const fonts = [{ name: 'Custom', url: 'https://fonts.com/custom.css' }];
      const { exportHtml } = useExport({
        authManager: createMockAuthManager(),
        getFontsConfig: () => ({ customFonts: fonts, defaultFallback: 'Arial' }),
        canUseCustomFonts: () => true,
      });

      await exportHtml('tmpl-1');

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: fonts,
        defaultFallback: 'Arial',
      });
    });

    it('defaults canUseCustomFonts to true', async () => {
      const fonts = [{ name: 'Custom', url: 'https://fonts.com/custom.css' }];
      const { exportHtml } = useExport({
        authManager: createMockAuthManager(),
        getFontsConfig: () => ({ customFonts: fonts, defaultFallback: 'Arial' }),
      });

      await exportHtml('tmpl-1');

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: fonts,
        defaultFallback: 'Arial',
      });
    });
  });

  describe('getMjmlSource', () => {
    it('returns only MJML string', async () => {
      const { getMjmlSource } = useExport({ authManager: createMockAuthManager() });

      const result = await getMjmlSource('tmpl-1');

      expect(result).toBe('<mjml>source</mjml>');
    });
  });

  describe('edge cases', () => {
    it('handles API response without mjml field gracefully', async () => {
      vi.mocked(ApiClient.prototype.exportTemplate).mockResolvedValue({
        html: '<html>rendered</html>',
      } as any);

      const { exportHtml } = useExport({ authManager: createMockAuthManager() });

      const result = await exportHtml('tmpl-1');

      expect(result.html).toBe('<html>rendered</html>');
      expect(result.mjml).toBeUndefined();
    });

    it('passes empty customFonts array with defaultFallback', async () => {
      const { exportHtml } = useExport({
        authManager: createMockAuthManager(),
        getFontsConfig: () => ({
          customFonts: [],
          defaultFallback: 'Helvetica, sans-serif',
        }),
      });

      await exportHtml('tmpl-1');

      expect(ApiClient.prototype.exportTemplate).toHaveBeenCalledWith('tmpl-1', {
        customFonts: [],
        defaultFallback: 'Helvetica, sans-serif',
      });
    });
  });
});
