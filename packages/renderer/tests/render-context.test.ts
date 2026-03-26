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

  it('withContainerWidth with zero width', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    const narrow = ctx.withContainerWidth(0);
    expect(narrow.containerWidth).toBe(0);
    expect(narrow.customFonts).toEqual([]);
    expect(narrow.defaultFallbackFont).toBe('Arial, sans-serif');
    expect(narrow.allowHtmlBlocks).toBe(true);
  });

  it('withContainerWidth preserves all other properties', () => {
    const fonts = [{ name: 'Inter', url: 'https://fonts.example.com/inter.css' }];
    const ctx = new RenderContext(600, fonts, 'Georgia, serif', false);
    const narrow = ctx.withContainerWidth(200);
    expect(narrow.customFonts).toBe(fonts);
    expect(narrow.defaultFallbackFont).toBe('Georgia, serif');
    expect(narrow.allowHtmlBlocks).toBe(false);
  });

  it('resolveFontFamily returns empty string as-is when no custom fonts match', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.resolveFontFamily('')).toBe('');
  });

  it('resolveFontFamily does not match empty string against custom font', () => {
    const ctx = new RenderContext(
      600,
      [{ name: 'Inter', url: 'https://fonts.example.com/inter.css' }],
      'Arial, sans-serif',
      true,
    );
    expect(ctx.resolveFontFamily('')).toBe('');
  });

  it('resolveFontFamily returns first matching custom font when multiple exist', () => {
    const ctx = new RenderContext(
      600,
      [
        { name: 'Inter', url: 'https://a.css', fallback: 'Helvetica' },
        { name: 'Inter', url: 'https://b.css', fallback: 'Georgia' },
      ],
      'Arial, sans-serif',
      true,
    );
    expect(ctx.resolveFontFamily('Inter')).toBe("'Inter', Helvetica");
  });
});
