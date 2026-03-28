import { describe, expect, it } from 'vitest';
import { createMenuBlock } from '@templatical/types';
import { renderBlock, RenderContext } from '../src';

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

describe('renderMenu', () => {
  it('renders menu items as anchor tags', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Home', url: 'https://example.com', openInNewTab: false, bold: false, underline: false },
        { id: '2', text: 'About', url: 'https://example.com/about', openInNewTab: false, bold: false, underline: false },
      ],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('>Home</a>');
    expect(result).toContain('<a href="https://example.com/about"');
    expect(result).toContain('>About</a>');
  });

  it('returns empty for empty items', () => {
    const block = createMenuBlock({ items: [] });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('renders separator between items but not after the last', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'A', url: '/', openInNewTab: false, bold: false, underline: false },
        { id: '2', text: 'B', url: '/', openInNewTab: false, bold: false, underline: false },
        { id: '3', text: 'C', url: '/', openInNewTab: false, bold: false, underline: false },
      ],
      separator: '|',
      separatorColor: '#ccc',
    });
    const result = renderBlock(block, ctx);
    // Two separators for three items
    const separatorCount = (result.match(/color: #ccc/g) || []).length;
    expect(separatorCount).toBe(2);
  });

  it('applies per-item color override', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Red', url: '/', openInNewTab: false, bold: false, underline: false, color: '#ff0000' },
      ],
      color: '#333333',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('color: #ff0000');
  });

  it('renders bold item with font-weight: bold', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Bold', url: '/', openInNewTab: false, bold: true, underline: false },
      ],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('font-weight: bold');
  });

  it('renders underline item with text-decoration: underline', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Underlined', url: '/', openInNewTab: false, bold: false, underline: true },
      ],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('text-decoration: underline');
  });

  it('renders bold and underline combo', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'BoldUnder', url: '/', openInNewTab: false, bold: true, underline: true },
      ],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('font-weight: bold');
    expect(result).toContain('text-decoration: underline');
  });

  it('adds target="_blank" for openInNewTab', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'External', url: 'https://example.com', openInNewTab: true, bold: false, underline: false },
      ],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('target="_blank"');
  });

  it('does not add target attribute when openInNewTab is false', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Internal', url: '/', openInNewTab: false, bold: false, underline: false },
      ],
    });
    const result = renderBlock(block, ctx);
    expect(result).not.toContain('target=');
  });

  it('returns empty for hidden block', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Hidden', url: '/', openInNewTab: false, bold: false, underline: false },
      ],
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  describe('edge cases', () => {
    it('escapes HTML entities in item text', () => {
      const block = createMenuBlock({
        items: [
          { id: '1', text: 'A & B <script>', url: '/', openInNewTab: false, bold: false, underline: false },
        ],
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('A &amp; B &lt;script&gt;');
    });

    it('escapes special chars in URL', () => {
      const block = createMenuBlock({
        items: [
          { id: '1', text: 'Link', url: 'https://example.com/path?a=1&b="2"', openInNewTab: false, bold: false, underline: false },
        ],
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('href="https://example.com/path?a=1&amp;b=&quot;2&quot;"');
    });

    it('single item has no separator', () => {
      const block = createMenuBlock({
        items: [
          { id: '1', text: 'Only', url: '/', openInNewTab: false, bold: false, underline: false },
        ],
        separator: '|',
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('>Only</a>');
      // Count separator occurrences — should be 0
      const separatorCount = (result.match(/\|/g) || []).length;
      expect(separatorCount).toBe(0);
    });
  });
});
