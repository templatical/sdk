import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en';
import de from '../src/i18n/locales/de';

describe('keyboard reorder i18n', () => {
  const keys = ['dragLifted', 'lifted', 'moved', 'dropped', 'cancelled'] as const;

  it.each(keys)('en.blockActions.%s is a non-empty string', (key) => {
    const value = (en.blockActions as unknown as Record<string, string>)[key];
    expect(value).toBeTypeOf('string');
    expect(value.length).toBeGreaterThan(0);
  });

  it.each(keys)('de.blockActions.%s is a non-empty string', (key) => {
    const value = (de.blockActions as unknown as Record<string, string>)[key];
    expect(value).toBeTypeOf('string');
    expect(value.length).toBeGreaterThan(0);
  });

  it('lifted announcement uses {block}, {position}, {total} placeholders', () => {
    for (const locale of [en, de]) {
      expect(locale.blockActions.lifted).toContain('{block}');
      expect(locale.blockActions.lifted).toContain('{position}');
      expect(locale.blockActions.lifted).toContain('{total}');
    }
  });

  it('moved and cancelled announcements use {position} placeholder', () => {
    for (const locale of [en, de]) {
      expect(locale.blockActions.moved).toContain('{position}');
      expect(locale.blockActions.cancelled).toContain('{position}');
    }
  });
});
