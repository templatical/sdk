import { describe, expect, it } from 'vitest';
import { getBlockLabel, getBlockTypeLabel } from '../src/utils/blockTypeLabels';
import { createTitleBlock } from '@templatical/types';
import type { Block, CustomBlockDefinition } from '@templatical/types';
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

describe('getBlockLabel', () => {
  const featuredArticle = {
    type: 'featured-article',
    name: 'Featured Article',
    fields: [],
    template: '',
  } as CustomBlockDefinition;

  const productGrid = {
    type: 'product-grid',
    name: 'Product Grid',
    fields: [],
    template: '',
  } as CustomBlockDefinition;

  function customBlock(customType: string): Block {
    return {
      id: `id-${customType}`,
      type: 'custom',
      customType,
      fieldValues: {},
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    } as unknown as Block;
  }

  it('delegates built-in blocks to the type label', () => {
    expect(getBlockLabel(createTitleBlock(), mockTranslations)).toBe('Title');
  });

  it('ignores custom definitions for a built-in block', () => {
    // A definition list is always passed in; it must not leak into built-ins.
    expect(
      getBlockLabel(createTitleBlock(), mockTranslations, [featuredArticle]),
    ).toBe('Title');
  });

  /* The whole point of the change: `blocks` has no `custom` key, so the old
     type-only helper rendered every custom block as the literal "custom". */
  it("resolves a custom block to the consumer's own name for it", () => {
    expect(
      getBlockLabel(customBlock('featured-article'), mockTranslations, [
        featuredArticle,
      ]),
    ).toBe('Featured Article');
  });

  it('distinguishes two different custom blocks', () => {
    const definitions = [featuredArticle, productGrid];
    expect(
      getBlockLabel(customBlock('featured-article'), mockTranslations, definitions),
    ).toBe('Featured Article');
    expect(
      getBlockLabel(customBlock('product-grid'), mockTranslations, definitions),
    ).toBe('Product Grid');
  });

  it('falls back to the customType slug when no definition matches', () => {
    // An instance whose definition was never registered — mirrors Toolbar.vue.
    // Still specific, and never the bare word "custom".
    expect(
      getBlockLabel(customBlock('unregistered'), mockTranslations, [
        featuredArticle,
      ]),
    ).toBe('unregistered');
  });

  it('falls back to the customType slug when definitions are omitted', () => {
    expect(getBlockLabel(customBlock('featured-article'), mockTranslations)).toBe(
      'featured-article',
    );
  });

  it('never renders the bare type string "custom"', () => {
    const cases = [
      getBlockLabel(customBlock('featured-article'), mockTranslations, [
        featuredArticle,
      ]),
      getBlockLabel(customBlock('unregistered'), mockTranslations, []),
      getBlockLabel(customBlock('featured-article'), mockTranslations),
    ];
    for (const label of cases) {
      expect(label).not.toBe('custom');
    }
    // Positive control: the resolved names are the real ones, so the negative
    // assertion above can't pass on an empty/undefined value.
    expect(cases).toEqual([
      'Featured Article',
      'unregistered',
      'featured-article',
    ]);
  });
});
