import { describe, expect, it } from 'vitest';
import {
  createTextBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
  createSpacerBlock,
  createHtmlBlock,
  createSocialIconsBlock,
  createMenuBlock,
  createTableBlock,
  createSectionBlock,
} from '@templatical/types';
import { renderBlock, RenderContext } from '../src';

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

describe('renderBlock', () => {
  it('renders text block', () => {
    const block = createTextBlock({ content: '<p>Hello</p>', fontSize: 16, color: '#333' });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-text');
    expect(result).toContain('font-size="16px"');
    expect(result).toContain('color="#333"');
    expect(result).toContain('<p>Hello</p>');
  });

  it('renders text block with merge tags converted', () => {
    const block = createTextBlock({
      content: 'Hi <span data-merge-tag="{{name}}">Name</span>',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('Hi {{name}}');
    expect(result).not.toContain('data-merge-tag');
  });

  it('renders image block', () => {
    const block = createImageBlock({ src: 'https://example.com/img.png', alt: 'Test', width: 300 });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-image');
    expect(result).toContain('src="https://example.com/img.png"');
    expect(result).toContain('alt="Test"');
    expect(result).toContain('width="300px"');
  });

  it('renders image block with full width', () => {
    const block = createImageBlock({ src: 'https://example.com/img.png', width: 'full' });
    const result = renderBlock(block, ctx);
    expect(result).toContain('width="600px"');
  });

  it('renders image block with link', () => {
    const block = createImageBlock({
      src: 'https://example.com/img.png',
      linkUrl: 'https://example.com',
      linkOpenInNewTab: true,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
  });

  it('renders button block', () => {
    const block = createButtonBlock({
      text: 'Click Me',
      url: 'https://example.com',
      backgroundColor: '#007bff',
      textColor: '#fff',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-button');
    expect(result).toContain('Click Me');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('background-color="#007bff"');
    expect(result).toContain('color="#fff"');
  });

  it('renders divider block', () => {
    const block = createDividerBlock({ color: '#ccc', thickness: 2, lineStyle: 'dashed' });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-divider');
    expect(result).toContain('border-color="#ccc"');
    expect(result).toContain('border-width="2px"');
    expect(result).toContain('border-style="dashed"');
  });

  it('renders spacer block', () => {
    const block = createSpacerBlock({ height: 40 });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-spacer');
    expect(result).toContain('height="40px"');
  });

  it('renders html block', () => {
    const block = createHtmlBlock({ content: '<div>Custom HTML</div>' });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-text');
    expect(result).toContain('<div>Custom HTML</div>');
  });

  it('returns empty for html block when not allowed', () => {
    const noHtmlCtx = new RenderContext(600, [], 'Arial, sans-serif', false);
    const block = createHtmlBlock({ content: '<div>Custom</div>' });
    const result = renderBlock(block, noHtmlCtx);
    expect(result).toBe('');
  });

  it('renders social icons block', () => {
    const block = createSocialIconsBlock({
      icons: [
        { id: '1', platform: 'facebook', url: 'https://facebook.com' },
        { id: '2', platform: 'twitter', url: 'https://twitter.com' },
      ],
      iconStyle: 'solid',
      iconSize: 'medium',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-social');
    expect(result).toContain('<mj-social-element');
    expect(result).toContain('href="https://facebook.com"');
    expect(result).toContain('href="https://twitter.com"');
    expect(result).toContain('data:image/svg+xml;base64,');
  });

  it('renders menu block', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Home', url: '/', openInNewTab: false, bold: false, underline: false },
        { id: '2', text: 'About', url: '/about', openInNewTab: true, bold: true, underline: false },
      ],
      separator: '|',
      separatorColor: '#ccc',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-text');
    expect(result).toContain('Home');
    expect(result).toContain('About');
    expect(result).toContain('|');
    expect(result).toContain('target="_blank"');
  });

  it('renders table block', () => {
    const block = createTableBlock();
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-text');
    expect(result).toContain('<table');
    expect(result).toContain('<tr>');
    expect(result).toContain('<th');
  });

  it('returns empty for blocks hidden on all viewports', () => {
    const block = createTextBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('adds visibility css classes', () => {
    const block = createTextBlock({
      visibility: { desktop: true, tablet: false, mobile: true },
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('css-class="tpl-hide-tablet"');
  });

  it('renders section with columns', () => {
    const child = createTextBlock({ content: '<p>Column content</p>' });
    const block = createSectionBlock({
      columns: '2',
      children: [[child], []],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-section');
    expect(result).toContain('<mj-column width="50%"');
    expect(result).toContain('Column content');
    expect(result).toContain('&nbsp;');
  });

  it('renders empty string for empty social icons', () => {
    const block = createSocialIconsBlock({ icons: [] });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('renders empty string for empty menu', () => {
    const block = createMenuBlock({ items: [] });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('renders empty string for empty html content', () => {
    const block = createHtmlBlock({ content: '' });
    expect(renderBlock(block, ctx)).toBe('');
  });
});
