import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en';
import de from '../src/i18n/locales/de';
import { loadMediaTranslations } from '../src/i18n';
import { useI18n } from '../src/composables/useI18n';

describe('i18n locales', () => {
  it('English has all expected top-level keys', () => {
    expect(en.mediaLibrary).toBeDefined();
    expect(en.mediaLibrary.title).toBe('Media Library');
  });

  it('German has all expected top-level keys', () => {
    expect(de.mediaLibrary).toBeDefined();
    expect(de.mediaLibrary.title).toBe('Medienbibliothek');
  });

  function getNestedEntries(
    obj: Record<string, unknown>,
    prefix = '',
  ): Array<[string, string]> {
    const entries: Array<[string, string]> = [];
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        entries.push(
          ...getNestedEntries(value as Record<string, unknown>, fullKey),
        );
      } else if (typeof value === 'string') {
        entries.push([fullKey, value]);
      }
    }
    return entries;
  }

  function getPlaceholders(value: string): string[] {
    return (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).slice().sort();
  }

  const enEntries = getNestedEntries(
    en as unknown as Record<string, unknown>,
  ).sort(([a], [b]) => a.localeCompare(b));
  const deEntries = getNestedEntries(
    de as unknown as Record<string, unknown>,
  ).sort(([a], [b]) => a.localeCompare(b));

  it('English and German have the same nested keys', () => {
    expect(enEntries.map(([k]) => k)).toEqual(deEntries.map(([k]) => k));
  });

  it('every key has matching placeholder tokens across locales', () => {
    const deMap = new Map(deEntries);
    const mismatches: Array<{ key: string; en: string[]; de: string[] }> = [];
    for (const [key, enValue] of enEntries) {
      const deValue = deMap.get(key);
      if (deValue === undefined) continue;
      const enPh = getPlaceholders(enValue);
      const dePh = getPlaceholders(deValue);
      if (enPh.join(',') !== dePh.join(',')) {
        mismatches.push({ key, en: enPh, de: dePh });
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('loadMediaTranslations', () => {
  it('loads English translations', async () => {
    const translations = await loadMediaTranslations('en');
    expect(translations.mediaLibrary.title).toBe('Media Library');
  });

  it('loads German translations', async () => {
    const translations = await loadMediaTranslations('de');
    expect(translations.mediaLibrary.title).toBe('Medienbibliothek');
  });

  it('normalizes locale with region code', async () => {
    const translations = await loadMediaTranslations('en-US');
    expect(translations.mediaLibrary.title).toBe('Media Library');
  });

  it('normalizes uppercase locale', async () => {
    const translations = await loadMediaTranslations('DE-de');
    expect(translations.mediaLibrary.title).toBe('Medienbibliothek');
  });

  it('falls back to English for unsupported locale', async () => {
    const translations = await loadMediaTranslations('fr');
    expect(translations.mediaLibrary.title).toBe('Media Library');
  });

  it('falls back to English for empty string', async () => {
    const translations = await loadMediaTranslations('');
    expect(translations.mediaLibrary.title).toBe('Media Library');
  });
});

describe('useI18n', () => {
  it('uses override translations', () => {
    const { t } = useI18n(en);
    expect(t.mediaLibrary.title).toBe('Media Library');
  });

  describe('format', () => {
    it('replaces single placeholder', () => {
      const { format } = useI18n(en);
      expect(format('{count} items', { count: 5 })).toBe('5 items');
    });

    it('replaces multiple placeholders', () => {
      const { format } = useI18n(en);
      expect(format('{current} of {total}', { current: 3, total: 10 })).toBe('3 of 10');
    });

    it('leaves missing placeholders unchanged', () => {
      const { format } = useI18n(en);
      expect(format('{name} - {missing}', { name: 'test' })).toBe('test - {missing}');
    });

    it('converts numbers to strings', () => {
      const { format } = useI18n(en);
      expect(format('Size: {size}', { size: 1024 })).toBe('Size: 1024');
    });

    it('handles string with no placeholders', () => {
      const { format } = useI18n(en);
      expect(format('No placeholders here', {})).toBe('No placeholders here');
    });

    it('handles empty string', () => {
      const { format } = useI18n(en);
      expect(format('', { key: 'value' })).toBe('');
    });

    it('formats actual translation strings', () => {
      const { format } = useI18n(en);
      expect(format(en.mediaLibrary.uploadingProgress, { current: 2, total: 5 })).toBe(
        'Uploading 2 of 5...',
      );
    });
  });
});
