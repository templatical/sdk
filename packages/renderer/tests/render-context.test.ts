import { describe, expect, it } from 'vitest';
import { RenderContext } from '../src';

describe('RenderContext', () => {
  it('stores container width', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.containerWidth).toBe(600);
  });

  it('defaults contentWidth to the container width', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.contentWidth).toBe(600);
  });

  it('takes contentWidth as its last argument', () => {
    const ctx = new RenderContext(
      600,
      [],
      'Arial, sans-serif',
      true,
      undefined,
      undefined,
      undefined,
      'rtl',
      540,
    );
    expect(ctx.containerWidth).toBe(600);
    expect(ctx.contentWidth).toBe(540);
    expect(ctx.contentDirection).toBe('rtl');
  });

  it('withContainerWidth sets both widths, or each on its own', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    const column = ctx.withContainerWidth(300);
    expect(column.containerWidth).toBe(300);
    expect(column.contentWidth).toBe(300);

    const padded = ctx.withContainerWidth(300, 260);
    expect(padded.containerWidth).toBe(300);
    expect(padded.contentWidth).toBe(260);
    expect(ctx.contentWidth).toBe(600);
  });

  it('withContainerWidth keeps the direction and renderers', () => {
    const image = () => '<mj-raw />';
    const ctx = new RenderContext(
      600,
      [],
      'Arial, sans-serif',
      true,
      undefined,
      undefined,
      { image },
      'rtl',
    );
    const column = ctx.withContainerWidth(300, 260);
    expect(column.contentDirection).toBe('rtl');
    expect(column.blockRenderers.image).toBe(image);
  });

  it('creates new context with different width', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    const narrow = ctx.withContainerWidth(300);
    expect(narrow.containerWidth).toBe(300);
    expect(ctx.containerWidth).toBe(600);
  });

  it('resolves built-in font to include fallback stack', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.resolveFontFamily('Helvetica')).toBe('Helvetica, sans-serif');
    expect(ctx.resolveFontFamily('Georgia')).toBe('Georgia, serif');
    expect(ctx.resolveFontFamily('Courier New')).toBe("'Courier New', monospace");
  });

  it('appends the default fallback to a lone unknown family, quoted', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.resolveFontFamily('UnknownFont')).toBe("'UnknownFont', Arial, sans-serif");
    expect(ctx.resolveFontFamily('Helvetica Neue')).toBe("'Helvetica Neue', Arial, sans-serif");
    expect(ctx.resolveFontFamily('"Helvetica Neue"')).toBe("'Helvetica Neue', Arial, sans-serif");
  });

  it('uses a configured default fallback', () => {
    const ctx = new RenderContext(600, [], 'Georgia, serif', true);
    expect(ctx.resolveFontFamily('Inter')).toBe("'Inter', Georgia, serif");
  });

  it('passes a stack through as written', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.resolveFontFamily('Montserrat, Trebuchet MS, sans-serif')).toBe(
      'Montserrat, Trebuchet MS, sans-serif',
    );
    expect(ctx.resolveFontFamily('"Helvetica Neue", Arial')).toBe('"Helvetica Neue", Arial');
  });

  it('leaves generic families, CSS-wide keywords and invalid values alone', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.resolveFontFamily('sans-serif')).toBe('sans-serif');
    expect(ctx.resolveFontFamily('inherit')).toBe('inherit');
    expect(ctx.resolveFontFamily('inherit, Arial')).toBe('inherit, Arial');
  });

  it('matches a quoted custom font name', () => {
    const ctx = new RenderContext(
      600,
      [{ name: 'Inter', url: 'https://fonts.example.com/inter.css' }],
      'Arial, sans-serif',
      true,
    );
    expect(ctx.resolveFontFamily("'Inter'")).toBe("'Inter', Arial, sans-serif");
  });

  it('resolves Tahoma from the shared built-in table', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.resolveFontFamily('tahoma')).toBe('Tahoma, sans-serif');
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

  it('defaults contentDirection to ltr', () => {
    const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);
    expect(ctx.contentDirection).toBe('ltr');
  });

  it('withContainerWidth preserves contentDirection', () => {
    const ctx = new RenderContext(
      600,
      [],
      'Arial, sans-serif',
      true,
      new Map(),
      undefined,
      {},
      'rtl',
    );
    expect(ctx.withContainerWidth(200).contentDirection).toBe('rtl');
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
