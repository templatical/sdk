import { describe, expect, it } from 'vitest';
import {
  labelClass,
  inputClass,
  btnClass,
  btnActiveClass,
  cardClass,
  outlineBtnClass,
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
    outlineBtnClass,
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
    expect(outlineBtnClass).toContain('tpl:transition');
  });

  it('input classes have focus styles', () => {
    expect(inputClass).toContain('focus:');
    expect(colorTextClass).toContain('focus:');
    expect(inputGroupInputClass).toContain('focus:');
  });

  it('button classes have hover styles', () => {
    expect(btnClass).toContain('hover:');
    expect(cardClass).toContain('hover:');
    expect(outlineBtnClass).toContain('hover:');
  });

  it('uses CSS custom properties for theming', () => {
    expect(inputClass).toContain('var(--tpl-');
    expect(btnClass).toContain('var(--tpl-');
    expect(cardClass).toContain('var(--tpl-');
  });

  it('uses spring easing function', () => {
    const springEasing = 'cubic-bezier(0.16,1,0.3,1)';
    expect(inputClass).toContain(springEasing);
    expect(btnClass).toContain(springEasing);
  });
});
