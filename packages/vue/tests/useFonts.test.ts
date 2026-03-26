import { describe, expect, it } from 'vitest';
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
      expect(roboto).toBeDefined();
      expect(roboto!.isCustom).toBe(true);
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

      expect(fonts.value.find((f) => f.label === 'Roboto')).toBeDefined();
    });
  });

  describe('defaultFont', () => {
    it('returns Arial fallback when no config', () => {
      const { defaultFont } = useFonts();
      expect(defaultFont.value).toBe('Arial, sans-serif');
    });

    it('returns configured default font', () => {
      const { defaultFont } = useFonts({ defaultFont: 'Georgia' });
      expect(defaultFont.value).toBe('Georgia, serif');
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
    it('returns matching font value for configured default', () => {
      const { getDefaultFont } = useFonts({ defaultFont: 'Helvetica' });
      expect(getDefaultFont()).toBe('Helvetica, sans-serif');
    });

    it('returns fallback for unavailable font', () => {
      const { getDefaultFont } = useFonts({ defaultFont: 'NonexistentFont' });
      expect(getDefaultFont()).toBe('Arial, sans-serif');
    });
  });

  describe('getFontWithFallback', () => {
    it('returns built-in font with its fallback stack', () => {
      const { getFontWithFallback } = useFonts();
      expect(getFontWithFallback('Arial')).toBe('Arial, sans-serif');
      expect(getFontWithFallback('Georgia')).toBe('Georgia, serif');
      expect(getFontWithFallback('Courier New')).toBe('Courier New, monospace');
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
});
