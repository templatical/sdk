import { describe, expect, it } from 'vitest';
import { RenderContext } from '../src';

describe('RenderContext', () => {
  it('stores container width', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.containerWidth).toBe(600);
  });

  it('creates new context with different width', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    const narrow = ctx.withContainerWidth(300);
    expect(narrow.containerWidth).toBe(300);
    expect(ctx.containerWidth).toBe(600);
  });

  it('returns font family as-is when no custom fonts', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.resolveFontFamily('Helvetica')).toBe('Helvetica');
  });

  it('resolves custom font with fallback', () => {
    const ctx = new RenderContext(
      600,
      [{ name: 'Inter', url: 'https://fonts.example.com/inter.css', fallback: 'Helvetica, sans-serif' }],
      'Arial, sans-serif',
      true,
    );
    expect(ctx.resolveFontFamily('Inter')).toBe("'Inter', Helvetica, sans-serif");
  });

  it('resolves custom font with default fallback', () => {
    const ctx = new RenderContext(
      600,
      [{ name: 'Inter', url: 'https://fonts.example.com/inter.css' }],
      'Arial, sans-serif',
      true,
    );
    expect(ctx.resolveFontFamily('Inter')).toBe("'Inter', Arial, sans-serif");
  });

  it('resolves custom font case-insensitively', () => {
    const ctx = new RenderContext(
      600,
      [{ name: 'Inter', url: 'https://fonts.example.com/inter.css' }],
      'Arial, sans-serif',
      true,
    );
    expect(ctx.resolveFontFamily('inter')).toBe("'Inter', Arial, sans-serif");
  });
});
