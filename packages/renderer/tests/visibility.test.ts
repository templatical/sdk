import { describe, expect, it } from 'vitest';
import { createTextBlock } from '@templatical/types';
import { isHiddenOnAll, getCssClassAttr, getCssClasses } from '../src';

describe('isHiddenOnAll', () => {
  it('returns false when no visibility set', () => {
    const block = createTextBlock();
    expect(isHiddenOnAll(block)).toBe(false);
  });

  it('returns true when hidden on all viewports', () => {
    const block = createTextBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(isHiddenOnAll(block)).toBe(true);
  });

  it('returns false when visible on at least one viewport', () => {
    const block = createTextBlock({
      visibility: { desktop: true, tablet: false, mobile: false },
    });
    expect(isHiddenOnAll(block)).toBe(false);
  });
});

describe('getCssClasses', () => {
  it('returns empty string when no visibility set', () => {
    const block = createTextBlock();
    expect(getCssClasses(block)).toBe('');
  });

  it('returns hide classes for hidden viewports', () => {
    const block = createTextBlock({
      visibility: { desktop: false, tablet: true, mobile: false },
    });
    expect(getCssClasses(block)).toBe('tpl-hide-desktop tpl-hide-mobile');
  });

  it('returns all hide classes when all hidden', () => {
    const block = createTextBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(getCssClasses(block)).toBe(
      'tpl-hide-desktop tpl-hide-tablet tpl-hide-mobile',
    );
  });
});

describe('getCssClassAttr', () => {
  it('returns empty string when no visibility set', () => {
    const block = createTextBlock();
    expect(getCssClassAttr(block)).toBe('');
  });

  it('returns css-class attribute string', () => {
    const block = createTextBlock({
      visibility: { desktop: true, tablet: false, mobile: true },
    });
    expect(getCssClassAttr(block)).toBe(' css-class="tpl-hide-tablet"');
  });
});
