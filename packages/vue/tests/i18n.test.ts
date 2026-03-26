import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en';
import de from '../src/i18n/locales/de';
import {
  getBaseLocale,
  loadTranslations,
  isLocaleSupported,
  getSupportedLocales,
} from '../src/i18n';
import { useI18n } from '../src/composables/useI18n';

describe('getBaseLocale', () => {
  it('extracts base from locale with region', () => {
    expect(getBaseLocale('en-US')).toBe('en');
    expect(getBaseLocale('de-DE')).toBe('de');
    expect(getBaseLocale('en-GB')).toBe('en');
  });

  it('lowercases the result', () => {
    expect(getBaseLocale('EN-US')).toBe('en');
    expect(getBaseLocale('DE')).toBe('de');
  });

  it('handles simple locale', () => {
    expect(getBaseLocale('en')).toBe('en');
    expect(getBaseLocale('de')).toBe('de');
  });

  it('handles empty string', () => {
    expect(getBaseLocale('')).toBe('');
  });
});

describe('isLocaleSupported', () => {
  it('returns true for supported locales', () => {
    expect(isLocaleSupported('en')).toBe(true);
    expect(isLocaleSupported('de')).toBe(true);
  });

  it('returns true for locale with region if base is supported', () => {
    expect(isLocaleSupported('en-US')).toBe(true);
    expect(isLocaleSupported('de-AT')).toBe(true);
  });

  it('returns false for unsupported locales', () => {
    expect(isLocaleSupported('fr')).toBe(false);
    expect(isLocaleSupported('ja')).toBe(false);
  });
});

describe('getSupportedLocales', () => {
  it('returns supported locales', () => {
    const locales = getSupportedLocales();
    expect(locales).toContain('en');
    expect(locales).toContain('de');
  });

  it('returns a new array (not a reference)', () => {
    const a = getSupportedLocales();
    const b = getSupportedLocales();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('loadTranslations', () => {
  it('loads English translations', async () => {
    const t = await loadTranslations('en');
    expect(t.header.title).toBe('Templatical');
  });

  it('loads German translations', async () => {
    const t = await loadTranslations('de');
    expect(t.loading.initializing).toBe('Initialisieren...');
  });

  it('normalizes locale with region', async () => {
    const t = await loadTranslations('en-US');
    expect(t.header.title).toBe('Templatical');
  });

  it('falls back to English for unsupported locale', async () => {
    const t = await loadTranslations('fr');
    expect(t.header.title).toBe('Templatical');
  });
});

describe('locale parity', () => {
  function getNestedKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        keys.push(...getNestedKeys(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  it('English and German have the same nested keys', () => {
    const enKeys = getNestedKeys(en).sort();
    const deKeys = getNestedKeys(de).sort();
    expect(enKeys).toEqual(deKeys);
  });

  it('both locales preserve placeholder tokens in key strings', () => {
    expect(en.header.templatesUsed).toContain('{used}');
    expect(en.header.templatesUsed).toContain('{max}');
    expect(de.header.templatesUsed).toContain('{used}');
    expect(de.header.templatesUsed).toContain('{max}');
  });
});

describe('useI18n', () => {
  it('uses override translations', () => {
    const { t } = useI18n(en);
    expect(t.header.title).toBe('Templatical');
  });

  describe('format', () => {
    const { format } = useI18n(en);

    it('replaces single placeholder', () => {
      expect(format('{count} items', { count: 5 })).toBe('5 items');
    });

    it('replaces multiple placeholders', () => {
      expect(format('{a} and {b}', { a: 'foo', b: 'bar' })).toBe('foo and bar');
    });

    it('leaves missing placeholders unchanged', () => {
      expect(format('{name} - {missing}', { name: 'test' })).toBe('test - {missing}');
    });

    it('converts numbers to strings', () => {
      expect(format('Page {n}', { n: 42 })).toBe('Page 42');
    });

    it('handles empty string', () => {
      expect(format('', { key: 'val' })).toBe('');
    });

    it('formats actual translation strings', () => {
      expect(
        format(en.header.templatesUsed, { used: 3, max: 10 }),
      ).toBe('3/10 templates used');
    });
  });
});
