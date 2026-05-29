import { describe, expect, it } from 'vitest';
import { createParagraphBlock } from '@templatical/types';
import { isHiddenOnAll, getCssClassAttr, getCssClasses } from '../src';

describe('isHiddenOnAll', () => {
  it('returns false when no visibility set', () => {
    const block = createParagraphBlock();
    expect(isHiddenOnAll(block)).toBe(false);
  });

  it('returns true when hidden on all viewports', () => {
    const block = createParagraphBlock({
      visibility: { desktop: false, mobile: false },
    });
    expect(isHiddenOnAll(block)).toBe(true);
  });

  it('returns false when visible on at least one viewport', () => {
    const block = createParagraphBlock({
      visibility: { desktop: true, mobile: false },
    });
    expect(isHiddenOnAll(block)).toBe(false);
  });
});

describe('getCssClasses', () => {
  it('returns empty string when no visibility set', () => {
    const block = createParagraphBlock();
    expect(getCssClasses(block)).toBe('');
  });

  it('returns hide classes for hidden viewports', () => {
    const block = createParagraphBlock({
      visibility: { desktop: false, mobile: false },
    });
    expect(getCssClasses(block)).toBe('tpl-hide-desktop tpl-hide-mobile');
  });
});

describe('getCssClassAttr', () => {
  it('returns empty string when no visibility set', () => {
    const block = createParagraphBlock();
    expect(getCssClassAttr(block)).toBe('');
  });

  it('returns css-class attribute string for desktop-hidden block', () => {
    const block = createParagraphBlock({
      visibility: { desktop: false, mobile: true },
    });
    expect(getCssClassAttr(block)).toBe(' css-class="tpl-hide-desktop"');
  });

  it('returns css-class attribute string for mobile-hidden block', () => {
    const block = createParagraphBlock({
      visibility: { desktop: true, mobile: false },
    });
    expect(getCssClassAttr(block)).toBe(' css-class="tpl-hide-mobile"');
  });
});

describe('visibility with null/undefined', () => {
  it('isHiddenOnAll returns false when visibility is undefined', () => {
    const block = createParagraphBlock();
    // block.visibility is undefined by default
    expect(block.visibility).toBeUndefined();
    expect(isHiddenOnAll(block)).toBe(false);
  });

  it('getCssClasses returns empty string when visibility is undefined', () => {
    const block = createParagraphBlock();
    expect(getCssClasses(block)).toBe('');
  });

  it('getCssClassAttr returns empty string when visibility is undefined', () => {
    const block = createParagraphBlock();
    expect(getCssClassAttr(block)).toBe('');
  });

  it('returns empty string when all viewports visible', () => {
    const block = createParagraphBlock({
      visibility: { desktop: true, mobile: true },
    });
    expect(getCssClasses(block)).toBe('');
    expect(getCssClassAttr(block)).toBe('');
  });

  it('returns only desktop hide class', () => {
    const block = createParagraphBlock({
      visibility: { desktop: false, mobile: true },
    });
    expect(getCssClasses(block)).toBe('tpl-hide-desktop');
  });

  it('returns only mobile hide class', () => {
    const block = createParagraphBlock({
      visibility: { desktop: true, mobile: false },
    });
    expect(getCssClasses(block)).toBe('tpl-hide-mobile');
  });
});
