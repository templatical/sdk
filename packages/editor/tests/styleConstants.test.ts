import { describe, expect, it } from 'vitest';
import {
  labelClass,
  inputClass,
  btnClass,
  btnActiveClass,
  cardClass,
  primaryBtnClass,
  secondaryBtnClass,
  primaryBtnCompactClass,
  secondaryBtnCompactClass,
  dangerBtnClass,
  dangerBtnCompactClass,
  colorInputClass,
  colorTextClass,
  inputGroupInputClass,
  inputSuffixClass,
} from '../src/constants/styleConstants';

describe('styleConstants', () => {
  const allClasses = {
    labelClass,
    inputClass,
    btnClass,
    btnActiveClass,
    cardClass,
    primaryBtnClass,
    secondaryBtnClass,
    primaryBtnCompactClass,
    secondaryBtnCompactClass,
    dangerBtnClass,
    dangerBtnCompactClass,
    colorInputClass,
    colorTextClass,
    inputGroupInputClass,
    inputSuffixClass,
  };

  it('all constants are non-empty strings', () => {
    for (const [name, value] of Object.entries(allClasses)) {
      expect(typeof value, `${name} should be a string`).toBe('string');
      expect(value.length, `${name} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('all classes use tpl: prefix', () => {
    for (const [name, value] of Object.entries(allClasses)) {
      expect(value, `${name} should contain tpl: prefix`).toContain('tpl:');
    }
  });

  it('interactive elements have transition classes', () => {
    expect(inputClass).toContain('tpl:transition');
    expect(btnClass).toContain('tpl:transition');
    expect(btnActiveClass).not.toContain('tpl:transition'); // Active state is static
    expect(cardClass).toContain('tpl:transition');
    expect(secondaryBtnClass).toContain('tpl:transition');
  });

  it('input classes have focus styles', () => {
    expect(inputClass).toContain('focus:');
    expect(colorTextClass).toContain('focus:');
    expect(inputGroupInputClass).toContain('focus:');
  });

  it('button classes have hover styles', () => {
    expect(btnClass).toContain('hover:');
    expect(cardClass).toContain('hover:');
    expect(secondaryBtnClass).toContain('tpl:hover:');
  });

  it('uses CSS custom properties for theming', () => {
    expect(inputClass).toContain('var(--tpl-');
    expect(btnClass).toContain('var(--tpl-');
    expect(cardClass).toContain('var(--tpl-');
  });

  describe('the button system', () => {
    const ALL = {
      primaryBtnClass,
      secondaryBtnClass,
      primaryBtnCompactClass,
      secondaryBtnCompactClass,
      dangerBtnClass,
      dangerBtnCompactClass,
    };
    const PRIMARIES = { primaryBtnClass, primaryBtnCompactClass };
    const SECONDARIES = { secondaryBtnClass, secondaryBtnCompactClass };

    it('every recipe is flat at rest and lifts on hover', () => {
      // DESIGN.md 5: a surface paints no shadow until something happens to it.
      // Four hand-rolled dialog buttons each carried a resting shadow before
      // they shared this base.
      for (const [name, recipe] of Object.entries(ALL)) {
        const resting = recipe
          .split(' ')
          .filter((c) => !c.includes('hover:') && !c.includes('focus'));
        expect(resting.filter((c) => c.includes('shadow')), name).toEqual([]);
        expect(recipe, name).toContain('tpl:hover:shadow-[var(--tpl-shadow-sm)]');
      }
    });

    it('every recipe rings on keyboard focus only', () => {
      // The Focus-Ring Rule: keyboard interaction rings, mouse does not.
      for (const [name, recipe] of Object.entries(ALL)) {
        expect(recipe, name).toContain('tpl:focus-visible:shadow-[var(--tpl-ring)]');
        expect(recipe, name).not.toMatch(/tpl:focus:(?!visible)/);
      }
    });

    it('primary deepens on hover rather than fading', () => {
      // `opacity` on hover washes the amber toward the page and reads as the
      // button leaving. DESIGN.md: "slightly deeper, never brighter".
      for (const [name, recipe] of Object.entries(PRIMARIES)) {
        expect(recipe, name).toContain('tpl:bg-[var(--tpl-primary)]');
        expect(recipe, name).toContain('tpl:hover:bg-[var(--tpl-primary-hover)]');
        expect(recipe, name).not.toContain('opacity-90');
      }
    });

    it('primary routes its label through --tpl-on-primary', () => {
      for (const [name, recipe] of Object.entries(PRIMARIES)) {
        expect(recipe, name).toContain('tpl:text-[var(--tpl-on-primary)]');
        expect(recipe, name).not.toContain('tpl:text-[var(--tpl-bg)]');
      }
    });

    it('secondary is muted at rest and saturates on hover', () => {
      for (const [name, recipe] of Object.entries(SECONDARIES)) {
        expect(recipe, name).toContain('tpl:text-[var(--tpl-text-muted)]');
        expect(recipe, name).toContain('tpl:hover:text-[var(--tpl-text)]');
        expect(recipe, name).toContain('tpl:bg-[var(--tpl-bg)]');
        // Amber is primary's job.
        expect(recipe, name).not.toContain('--tpl-primary)');
      }
    });

    it('danger is outlined, deepens on hover, and never fills', () => {
      // Outlined by choice: a delete button should be findable, not the loudest
      // thing on the surface. Filling buys nothing anyway — label-on-bg and
      // bg-label-on-danger are the same pair, 3.76:1 light / 5.41:1 dark.
      for (const [name, recipe] of Object.entries({ dangerBtnClass, dangerBtnCompactClass })) {
        expect(recipe, name).toContain('tpl:border-[var(--tpl-danger)]');
        expect(recipe, name).toContain('tpl:text-[var(--tpl-danger)]');
        expect(recipe, name).toContain('tpl:bg-[var(--tpl-bg)]');
        expect(recipe, name).toContain('tpl:hover:bg-[var(--tpl-danger-light)]');
        // Not a filled surface, and never faded on hover.
        expect(recipe, name).not.toContain('tpl:bg-[var(--tpl-danger)]');
        expect(recipe, name).not.toContain('opacity-90');
      }
    });

    it('the two scales differ only in geometry', () => {
      // Composed from one base and one skin per variant, so the pairs are
      // identical apart from radius, padding and type size.
      const geometry = /tpl:(rounded|px-|py-|text-(xs|sm))\S*/g;
      const strip = (c: string) => c.replace(geometry, '').split(/\s+/).filter(Boolean).sort().join(' ');
      expect(strip(primaryBtnClass)).toBe(strip(primaryBtnCompactClass));
      expect(strip(secondaryBtnClass)).toBe(strip(secondaryBtnCompactClass));
      expect(strip(dangerBtnClass)).toBe(strip(dangerBtnCompactClass));
    });

    it('default scale is dialog-sized, compact is the 38px chrome size', () => {
      for (const token of ['tpl:rounded-md', 'tpl:px-3', 'tpl:py-1.5', 'tpl:text-sm']) {
        expect(primaryBtnClass).toContain(token);
        expect(secondaryBtnClass).toContain(token);
      }
      for (const token of ['tpl:rounded-[var(--tpl-radius-sm)]', 'tpl:px-3', 'tpl:py-2.5', 'tpl:text-xs']) {
        expect(primaryBtnCompactClass).toContain(token);
        expect(secondaryBtnCompactClass).toContain(token);
      }
    });
  });

  it('uses spring easing function', () => {
    const springEasing = 'cubic-bezier(0.16,1,0.3,1)';
    expect(inputClass).toContain(springEasing);
    expect(btnClass).toContain(springEasing);
  });
});
