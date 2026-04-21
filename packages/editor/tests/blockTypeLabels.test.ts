import { describe, expect, it } from 'vitest';
import { getBlockTypeLabel } from '../src/utils/blockTypeLabels';
import type { Translations } from '../src/i18n';

const mockTranslations = {
  blocks: {
    section: 'Section',
    image: 'Image',
    title: 'Title',
    paragraph: 'Paragraph',
    button: 'Button',
    divider: 'Divider',
    video: 'Video',
    social: 'Social',
    menu: 'Menu',
    table: 'Table',
    spacer: 'Spacer',
    countdown: 'Countdown',
    html: 'HTML',
  },
} as unknown as Translations;

describe('getBlockTypeLabel', () => {
  it('returns the translated label for known block types', () => {
    expect(getBlockTypeLabel('section', mockTranslations)).toBe('Section');
    expect(getBlockTypeLabel('image', mockTranslations)).toBe('Image');
    expect(getBlockTypeLabel('html', mockTranslations)).toBe('HTML');
    expect(getBlockTypeLabel('countdown', mockTranslations)).toBe('Countdown');
    expect(getBlockTypeLabel('video', mockTranslations)).toBe('Video');
  });

  it('falls back to the raw type string for unknown block types', () => {
    expect(getBlockTypeLabel('unknown', mockTranslations)).toBe('unknown');
    expect(getBlockTypeLabel('custom', mockTranslations)).toBe('custom');
  });

  it('covers all 13 built-in block types with correct translations', () => {
    const expectedLabels: Record<string, string> = {
      section: 'Section',
      image: 'Image',
      title: 'Title',
      paragraph: 'Paragraph',
      button: 'Button',
      divider: 'Divider',
      video: 'Video',
      social: 'Social',
      menu: 'Menu',
      table: 'Table',
      spacer: 'Spacer',
      countdown: 'Countdown',
      html: 'HTML',
    };
    for (const [type, expected] of Object.entries(expectedLabels)) {
      expect(getBlockTypeLabel(type, mockTranslations)).toBe(expected);
    }
  });
});
