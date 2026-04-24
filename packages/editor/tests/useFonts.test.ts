import './dom-stubs';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { effectScope } from 'vue';
import { useFonts } from '../src/composables/useFonts';

describe('useFonts', () => {
  describe('initialization', () => {
    it('initializes with built-in fonts when no config', () => {
      const { fonts } = useFonts();
      expect(fonts.value.length).toBeGreaterThanOrEqual(7);
      expect(fonts.value.some((f) => f.label === 'Arial')).toBe(true);
      expect(fonts.value.some((f) => f.label === 'Georgia')).toBe(true);
    });

    it('sorts fonts alphabetically', () => {
      const { fonts } = useFonts();
      const labels = fonts.value.map((f) => f.label);
      const sorted = [...labels].sort((a, b) => a.localeCompare(b));
      expect(labels).toEqual(sorted);
    });

    it('starts with customFontsEnabled true', () => {
      const { customFontsEnabled } = useFonts();
      expect(customFontsEnabled.value).toBe(true);
    });

    it('starts with isLoaded false', () => {
      const { isLoaded } = useFonts();
      expect(isLoaded.value).toBe(false);
    });
  });

  describe('custom fonts', () => {
    it('includes custom fonts in list when provided', () => {
      const { fonts } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
      });

      const roboto = fonts.value.find((f) => f.label === 'Roboto');
      expect(roboto).not.toBeUndefined();
      expect(roboto!.isCustom).toBe(true);
      expect(roboto!.value).toBe('Roboto');
    });

    it('excludes custom fonts when disabled', () => {
      const { fonts, setCustomFontsEnabled } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
      });

      setCustomFontsEnabled(false);

      expect(fonts.value.find((f) => f.label === 'Roboto')).toBeUndefined();
    });

    it('re-includes custom fonts when re-enabled', () => {
      const { fonts, setCustomFontsEnabled } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
      });

      setCustomFontsEnabled(false);
      setCustomFontsEnabled(true);

      const roboto = fonts.value.find((f) => f.label === 'Roboto');
      expect(roboto).not.toBeUndefined();
      expect(roboto!.isCustom).toBe(true);
    });

    it('custom font with same name as built-in is included as custom', () => {
      const { fonts } = useFonts({
        customFonts: [{ name: 'Arial', url: 'https://fonts.com/arial-custom.css' }],
      });

      const arialFonts = fonts.value.filter((f) => f.label === 'Arial');
      expect(arialFonts.length).toBe(2); // built-in + custom
      expect(arialFonts.some((f) => f.isCustom)).toBe(true);
    });
  });

  describe('defaultFont', () => {
    it('returns Arial fallback when no config', () => {
      const { defaultFont } = useFonts();
      expect(defaultFont.value).toBe('Arial, sans-serif');
    });

    it('returns configured default font as bare name', () => {
      const { defaultFont } = useFonts({ defaultFont: 'Georgia' });
      expect(defaultFont.value).toBe('Georgia');
    });

    it('falls back to Arial when default font is custom but custom fonts disabled', () => {
      const { defaultFont, setCustomFontsEnabled } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
        defaultFont: 'Roboto',
      });

      setCustomFontsEnabled(false);
      expect(defaultFont.value).toBe('Arial, sans-serif');
    });
  });

  describe('defaultFallback', () => {
    it('returns Arial, sans-serif by default', () => {
      const { defaultFallback } = useFonts();
      expect(defaultFallback.value).toBe('Arial, sans-serif');
    });

    it('returns configured fallback', () => {
      const { defaultFallback } = useFonts({ defaultFallback: 'Georgia, serif' });
      expect(defaultFallback.value).toBe('Georgia, serif');
    });
  });

  describe('getDefaultFont', () => {
    it('returns matching font value for configured default as bare name', () => {
      const { getDefaultFont } = useFonts({ defaultFont: 'Helvetica' });
      expect(getDefaultFont()).toBe('Helvetica');
    });

    it('returns fallback for unavailable font', () => {
      const { getDefaultFont } = useFonts({ defaultFont: 'NonexistentFont' });
      expect(getDefaultFont()).toBe('Arial, sans-serif');
    });

    it('returns fallback when no config provided', () => {
      const { getDefaultFont } = useFonts();
      expect(getDefaultFont()).toBe('Arial, sans-serif');
    });

    it('returns custom font value when available', () => {
      const { getDefaultFont } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
        defaultFont: 'Roboto',
      });
      expect(getDefaultFont()).toBe('Roboto');
    });

    it('returns fallback when default is custom but custom fonts disabled', () => {
      const { getDefaultFont, setCustomFontsEnabled } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
        defaultFont: 'Roboto',
      });

      setCustomFontsEnabled(false);
      expect(getDefaultFont()).toBe('Arial, sans-serif');
    });

    it('is case-insensitive for matching', () => {
      const { getDefaultFont } = useFonts({ defaultFont: 'arial' });
      expect(getDefaultFont()).toBe('Arial');
    });
  });

  describe('isFontAvailable (via getDefaultFont behavior)', () => {
    it('recognizes built-in fonts', () => {
      // isFontAvailable is internal but drives getDefaultFont behavior
      const { getDefaultFont } = useFonts({ defaultFont: 'Georgia' });
      expect(getDefaultFont()).toBe('Georgia');
    });

    it('recognizes custom fonts', () => {
      const { getDefaultFont } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
        defaultFont: 'Roboto',
      });
      expect(getDefaultFont()).toBe('Roboto');
    });

    it('does not recognize unknown fonts', () => {
      const { getDefaultFont } = useFonts({ defaultFont: 'FakeFont' });
      expect(getDefaultFont()).toBe('Arial, sans-serif');
    });
  });

  describe('isBuiltInFont (via custom fonts disabled behavior)', () => {
    it('allows built-in font as default when custom fonts disabled', () => {
      const { getDefaultFont, setCustomFontsEnabled } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
        defaultFont: 'Georgia',
      });

      setCustomFontsEnabled(false);
      // Georgia is built-in so it should still work
      expect(getDefaultFont()).toBe('Georgia');
    });

    it('rejects custom font as default when custom fonts disabled', () => {
      const { getDefaultFont, setCustomFontsEnabled } = useFonts({
        customFonts: [{ name: 'MyFont', url: 'https://fonts.com/myfont.css' }],
        defaultFont: 'MyFont',
      });

      setCustomFontsEnabled(false);
      expect(getDefaultFont()).toBe('Arial, sans-serif');
    });
  });

  describe('getFontWithFallback', () => {
    it('returns built-in font with its fallback stack', () => {
      const { getFontWithFallback } = useFonts();
      expect(getFontWithFallback('Arial')).toBe('Arial, sans-serif');
      expect(getFontWithFallback('Georgia')).toBe('Georgia, serif');
      expect(getFontWithFallback('Courier New')).toBe("'Courier New', monospace");
    });

    it('returns custom font with quotes and fallback', () => {
      const { getFontWithFallback } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
      });

      expect(getFontWithFallback('Roboto')).toBe("'Roboto', Arial, sans-serif");
    });

    it('uses custom font fallback when specified', () => {
      const { getFontWithFallback } = useFonts({
        customFonts: [
          { name: 'Roboto', url: 'https://fonts.com/roboto.css', fallback: 'Helvetica, sans-serif' },
        ],
      });

      expect(getFontWithFallback('Roboto')).toBe("'Roboto', Helvetica, sans-serif");
    });

    it('returns unknown font with default fallback appended', () => {
      const { getFontWithFallback } = useFonts();
      expect(getFontWithFallback('UnknownFont')).toBe('UnknownFont, Arial, sans-serif');
    });

    it('returns value as-is if it already contains a comma', () => {
      const { getFontWithFallback } = useFonts();
      expect(getFontWithFallback('Custom, serif')).toBe('Custom, serif');
    });

    it('handles empty string font name', () => {
      const { getFontWithFallback } = useFonts();
      const result = getFontWithFallback('');
      // Empty string is falsy, so falls back to default
      expect(result).toBe('Arial, sans-serif');
    });

    it('is case-insensitive', () => {
      const { getFontWithFallback } = useFonts();
      expect(getFontWithFallback('arial')).toBe('Arial, sans-serif');
      expect(getFontWithFallback('GEORGIA')).toBe('Georgia, serif');
    });
  });

  describe('loadCustomFonts', () => {
    it('sets isLoaded immediately when no custom fonts', async () => {
      const { isLoaded, loadCustomFonts } = useFonts();
      await loadCustomFonts();
      expect(isLoaded.value).toBe(true);
    });
  });

  describe('duplicate fonts in list', () => {
    it('includes both built-in and custom font with same name', () => {
      const { fonts } = useFonts({
        customFonts: [
          { name: 'Arial', url: 'https://fonts.com/arial-custom.css' },
        ],
      });

      const arialFonts = fonts.value.filter((f) => f.label === 'Arial');
      expect(arialFonts.length).toBe(2);
    });

    it('multiple custom fonts appear correctly', () => {
      const { fonts } = useFonts({
        customFonts: [
          { name: 'Roboto', url: 'https://fonts.com/roboto.css' },
          { name: 'Open Sans', url: 'https://fonts.com/opensans.css' },
          { name: 'Lato', url: 'https://fonts.com/lato.css' },
        ],
      });

      expect(fonts.value.some((f) => f.label === 'Roboto' && f.isCustom)).toBe(true);
      expect(fonts.value.some((f) => f.label === 'Open Sans' && f.isCustom)).toBe(true);
      expect(fonts.value.some((f) => f.label === 'Lato' && f.isCustom)).toBe(true);
      // 7 built-in + 3 custom
      expect(fonts.value.length).toBe(10);
    });
  });

  describe('setCustomFontsEnabled', () => {
    it('toggles custom fonts visibility', () => {
      const { fonts, setCustomFontsEnabled } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
      });

      expect(fonts.value.length).toBe(8); // 7 built-in + 1 custom
      setCustomFontsEnabled(false);
      expect(fonts.value.length).toBe(7); // only built-in
      setCustomFontsEnabled(true);
      expect(fonts.value.length).toBe(8); // back to 8
    });
  });

  describe('loadCustomFonts with DOM', () => {
    let appendedLinks: any[];
    let createElementSpy: ReturnType<typeof vi.fn>;
    let querySelectorSpy: ReturnType<typeof vi.fn>;
    let appendChildSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      appendedLinks = [];

      // Set up CSS.escape
      (globalThis as any).CSS = { escape: (value: string) => value };

      // Set up document.head if not present
      if (!(document as any).head) {
        (document as any).head = { appendChild: () => {} };
      }

      querySelectorSpy = vi.fn(() => null);
      (document as any).querySelector = querySelectorSpy;

      createElementSpy = vi.fn((tag: string) => {
        if (tag === 'link') {
          return {
            rel: '',
            href: '',
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
            setAttribute: vi.fn(),
            remove: vi.fn(),
          };
        }
        return { nodeType: 1, tagName: tag.toUpperCase() };
      });
      (document as any).createElement = createElementSpy;
    });

    afterEach(() => {
      vi.restoreAllMocks();
      delete (globalThis as any).CSS;
    });

    function setupAppendChild(options?: {
      triggerOnload?: boolean;
      triggerOnerror?: boolean;
    }) {
      const { triggerOnload = true, triggerOnerror = false } = options ?? {};
      appendChildSpy = vi.fn((child: any) => {
        appendedLinks.push(child);
        if (triggerOnerror && child.onerror) {
          child.onerror();
        } else if (triggerOnload && child.onload) {
          child.onload();
        }
        return child;
      });
      (document as any).head.appendChild = appendChildSpy;
    }

    it('creates link elements with correct attributes for custom fonts', async () => {
      setupAppendChild({ triggerOnload: true });

      const { loadCustomFonts, isLoaded } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
      });

      await loadCustomFonts();

      expect(createElementSpy).toHaveBeenCalledWith('link');
      expect(appendedLinks.length).toBe(1);

      const link = appendedLinks[0];
      expect(link.rel).toBe('stylesheet');
      expect(link.href).toBe('https://fonts.com/roboto.css');
      expect(link.setAttribute).toHaveBeenCalledWith('data-custom-font', 'Roboto');
      expect(isLoaded.value).toBe(true);
    });

    it('skips creating link when font already exists in DOM', async () => {
      querySelectorSpy.mockReturnValue({} as Element); // existing link found
      setupAppendChild({ triggerOnload: true });

      const { loadCustomFonts, isLoaded } = useFonts({
        customFonts: [{ name: 'Roboto', url: 'https://fonts.com/roboto.css' }],
      });

      await loadCustomFonts();

      expect(createElementSpy).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();
      expect(isLoaded.value).toBe(true);
    });

    it('handles font load error gracefully with console.warn', async () => {
      setupAppendChild({ triggerOnerror: true });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { loadCustomFonts, isLoaded } = useFonts({
        customFonts: [{ name: 'BadFont', url: 'https://fonts.com/bad.css' }],
      });

      await loadCustomFonts();

      expect(warnSpy).toHaveBeenCalledWith(
        '[Templatical]',
        'Failed to load custom font "BadFont":',
        expect.any(Error),
      );
      expect(isLoaded.value).toBe(true);
      warnSpy.mockRestore();
    });

    it('loads multiple fonts and sets isLoaded after all settle', async () => {
      setupAppendChild({ triggerOnload: true });

      const { loadCustomFonts, isLoaded } = useFonts({
        customFonts: [
          { name: 'Roboto', url: 'https://fonts.com/roboto.css' },
          { name: 'Lato', url: 'https://fonts.com/lato.css' },
        ],
      });

      await loadCustomFonts();

      expect(appendedLinks.length).toBe(2);
      expect(isLoaded.value).toBe(true);
    });

    it('loads some fonts successfully even when others fail', async () => {
      let callCount = 0;
      appendChildSpy = vi.fn((child: any) => {
        appendedLinks.push(child);
        callCount++;
        if (callCount === 1 && child.onload) {
          child.onload();
        } else if (child.onerror) {
          child.onerror();
        }
        return child;
      });
      (document as any).head.appendChild = appendChildSpy;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { loadCustomFonts, isLoaded } = useFonts({
        customFonts: [
          { name: 'GoodFont', url: 'https://fonts.com/good.css' },
          { name: 'BadFont', url: 'https://fonts.com/bad.css' },
        ],
      });

      await loadCustomFonts();

      expect(isLoaded.value).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        '[Templatical]',
        'Failed to load custom font "BadFont":',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe('cleanupFontLinks', () => {
    it('calls remove on each created link and clears internal array', async () => {
      (globalThis as any).CSS = { escape: (value: string) => value };
      if (!(document as any).head) {
        (document as any).head = { appendChild: () => {} };
      }

      const createdLinks: any[] = [];

      (document as any).querySelector = vi.fn(() => null);
      (document as any).createElement = vi.fn((tag: string) => {
        if (tag === 'link') {
          const mockLink = {
            rel: '',
            href: '',
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
            setAttribute: vi.fn(),
            remove: vi.fn(),
          };
          createdLinks.push(mockLink);
          return mockLink;
        }
        return { nodeType: 1, tagName: tag.toUpperCase() };
      });
      (document as any).head.appendChild = vi.fn((child: any) => {
        if (child.onload) {
          child.onload();
        }
        return child;
      });

      const { loadCustomFonts, cleanupFontLinks } = useFonts({
        customFonts: [
          { name: 'FontA', url: 'https://fonts.com/a.css' },
          { name: 'FontB', url: 'https://fonts.com/b.css' },
        ],
      });

      await loadCustomFonts();

      expect(createdLinks.length).toBe(2);

      cleanupFontLinks();

      for (const link of createdLinks) {
        expect(link.remove).toHaveBeenCalled();
      }

      // Calling cleanup again should not call remove again (array was cleared)
      const removeCalls = createdLinks.map((l) => l.remove.mock.calls.length);
      cleanupFontLinks();
      for (let i = 0; i < createdLinks.length; i++) {
        expect(createdLinks[i].remove.mock.calls.length).toBe(removeCalls[i]);
      }

      delete (globalThis as any).CSS;
    });
  });

  describe('onScopeDispose cleanup', () => {
    it('registers cleanup when created inside an effect scope', async () => {
      (globalThis as any).CSS = { escape: (value: string) => value };
      if (!(document as any).head) {
        (document as any).head = { appendChild: () => {} };
      }

      const createdLinks: any[] = [];

      (document as any).querySelector = vi.fn(() => null);
      (document as any).createElement = vi.fn((tag: string) => {
        if (tag === 'link') {
          const mockLink = {
            rel: '',
            href: '',
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
            setAttribute: vi.fn(),
            remove: vi.fn(),
          };
          createdLinks.push(mockLink);
          return mockLink;
        }
        return { nodeType: 1, tagName: tag.toUpperCase() };
      });
      (document as any).head.appendChild = vi.fn((child: any) => {
        if (child.onload) {
          child.onload();
        }
        return child;
      });

      const scope = effectScope();
      let loadFn: (() => Promise<void>) | undefined;

      scope.run(() => {
        const { loadCustomFonts } = useFonts({
          customFonts: [{ name: 'ScopedFont', url: 'https://fonts.com/scoped.css' }],
        });
        loadFn = loadCustomFonts;
      });

      await loadFn!();
      expect(createdLinks.length).toBe(1);

      // Stopping the scope triggers onScopeDispose, which calls cleanupFontLinks
      scope.stop();

      expect(createdLinks[0].remove).toHaveBeenCalled();

      delete (globalThis as any).CSS;
    });
  });
});
