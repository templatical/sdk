import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en';
import de from '../src/i18n/locales/de';

describe('landmark i18n keys', () => {
  const keys = ['canvas', 'blockToolbar', 'rightSidebar', 'reorderAnnouncements'] as const;

  it.each(keys)('en exposes landmarks.%s as a non-empty string', (key) => {
    expect(en.landmarks[key]).toBeTypeOf('string');
    expect(en.landmarks[key].length).toBeGreaterThan(0);
  });

  it.each(keys)('de exposes landmarks.%s as a non-empty string', (key) => {
    expect(de.landmarks[key]).toBeTypeOf('string');
    expect(de.landmarks[key].length).toBeGreaterThan(0);
  });

  it('en and de cover the same landmark keys (no parity drift)', () => {
    expect(Object.keys(en.landmarks).sort()).toEqual(
      Object.keys(de.landmarks).sort(),
    );
  });
});
