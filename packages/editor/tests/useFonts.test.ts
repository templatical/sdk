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
});
