import { describe, expect, it } from 'vitest';
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
  createSpacerBlock,
  createHtmlBlock,
  createSocialIconsBlock,
  createMenuBlock,
  createTableBlock,
  createSectionBlock,
  createCountdownBlock,
  createVideoBlock,
  HEADING_LEVEL_FONT_SIZE,
} from '@templatical/types';
import type { Block, CustomBlock } from '@templatical/types';
import { renderBlock, RenderContext } from '../src';

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

describe('renderBlock', () => {
  it('renders title block with heading tag and font size from level', () => {
    const block = createTitleBlock({ content: '<p>Hello</p>', level: 1, color: '#333', textAlign: 'center' });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-text');
    expect(result).toContain(`font-size="${HEADING_LEVEL_FONT_SIZE[1]}px"`);
    expect(result).toContain('color="#333"');
    expect(result).toContain('<h1');
    expect(result).toContain('Hello');
    expect(result).toContain('</h1>');
  });

  it('renders title block level 3 with correct font size', () => {
    const block = createTitleBlock({ content: '<p>Subheading</p>', level: 3 });
    const result = renderBlock(block, ctx);
    expect(result).toContain(`font-size="${HEADING_LEVEL_FONT_SIZE[3]}px"`);
    expect(result).toContain('<h3');
    expect(result).toContain('</h3>');
  });

  it('renders paragraph block with content pass-through', () => {
    const block = createParagraphBlock({ content: '<p>Hello</p>' });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-text');
    expect(result).toContain('<p>Hello</p>');
    // Paragraph does not have block-level font-size or color attributes
    expect(result).not.toContain('font-size=');
    expect(result).not.toContain('color=');
  });

  it('renders paragraph block with merge tags converted', () => {
    const block = createParagraphBlock({
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
    // Smoke test: dispatch works — detail assertions in social.test.ts
    expect(result).toContain('<mj-social');
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
    const block = createParagraphBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('adds visibility css classes', () => {
    const block = createParagraphBlock({
      visibility: { desktop: true, tablet: false, mobile: true },
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('css-class="tpl-hide-tablet"');
  });

  it('renders section with columns', () => {
    const child = createParagraphBlock({ content: '<p>Column content</p>' });
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

  it('renders empty string for empty menu', () => {
    const block = createMenuBlock({ items: [] });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('renders empty string for empty html content', () => {
    const block = createHtmlBlock({ content: '' });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('returns empty string for countdown block (rendered by Cloud backend)', () => {
    const block = createCountdownBlock();
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('returns empty string for unknown/invalid block type', () => {
    const block = {
      id: '1',
      type: 'nonexistent' as never,
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    } as Block;
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('renders custom block with renderedHtml', () => {
    const block: CustomBlock = {
      id: '1',
      type: 'custom',
      customType: 'product-card',
      fieldValues: {},
      renderedHtml: '<div>Custom Content</div>',
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-text');
    expect(result).toContain('<div>Custom Content</div>');
  });

  it('returns empty string for custom block without renderedHtml', () => {
    const block: CustomBlock = {
      id: '1',
      type: 'custom',
      customType: 'product-card',
      fieldValues: {},
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('returns empty string for custom block with empty renderedHtml', () => {
    const block: CustomBlock = {
      id: '1',
      type: 'custom',
      customType: 'product-card',
      fieldValues: {},
      renderedHtml: '',
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('returns empty string for custom block hidden on all viewports', () => {
    const block: CustomBlock = {
      id: '1',
      type: 'custom',
      customType: 'product-card',
      fieldValues: {},
      renderedHtml: '<div>Content</div>',
      visibility: { desktop: false, tablet: false, mobile: false },
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('adds visibility classes to custom block', () => {
    const block: CustomBlock = {
      id: '1',
      type: 'custom',
      customType: 'product-card',
      fieldValues: {},
      renderedHtml: '<div>Content</div>',
      visibility: { desktop: true, tablet: false, mobile: true },
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    const result = renderBlock(block, ctx);
    expect(result).toContain('css-class="tpl-hide-tablet"');
  });

  it('renders video block with YouTube URL', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      alt: 'Video',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<mj-image');
    expect(result).toContain('img.youtube.com/vi/dQw4w9WgXcQ');
    expect(result).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
  });

  it('renders video block with custom thumbnail', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      alt: 'My Video',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('src="https://example.com/thumb.jpg"');
  });

  it('returns empty string for video block with no URL and no thumbnail', () => {
    const block = createVideoBlock({ url: '', thumbnailUrl: '' });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('returns empty for title block hidden on all viewports', () => {
    const block = createTitleBlock({
      content: '<p>Hidden</p>',
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('returns empty for button block hidden on all viewports', () => {
    const block = createButtonBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('returns empty for image block hidden on all viewports', () => {
    const block = createImageBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('returns empty for spacer block hidden on all viewports', () => {
    const block = createSpacerBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('returns empty for divider block hidden on all viewports', () => {
    const block = createDividerBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('returns empty for html block hidden on all viewports', () => {
    const block = createHtmlBlock({
      content: '<div>Hidden</div>',
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('returns empty for section block hidden on all viewports', () => {
    const child = createParagraphBlock({ content: '<p>Hidden</p>' });
    const block = createSectionBlock({
      children: [[child]],
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    expect(renderBlock(block, ctx)).toBe('');
  });

  it('section filters out html blocks when html is not allowed', () => {
    const noHtmlCtx = new RenderContext(600, [], 'Arial, sans-serif', false);
    const htmlChild = createHtmlBlock({ content: '<div>Custom</div>' });
    const textChild = createParagraphBlock({ content: '<p>Visible</p>' });
    const block = createSectionBlock({
      children: [[htmlChild, textChild]],
    });
    const result = renderBlock(block, noHtmlCtx);
    expect(result).toContain('Visible');
    expect(result).not.toContain('Custom');
  });

  it('title renders font-family when specified', () => {
    const block = createTitleBlock({
      content: '<p>Hello</p>',
      fontFamily: 'Georgia, serif',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('font-family="Georgia, serif"');
  });

  it('button renders font-family when specified', () => {
    const block = createButtonBlock({
      fontFamily: 'Verdana, sans-serif',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('font-family="Verdana, sans-serif"');
  });

  it('menu renders font-family when specified', () => {
    const block = createMenuBlock({
      items: [
        { id: '1', text: 'Home', url: '/', openInNewTab: false, bold: false, underline: false },
      ],
      fontFamily: 'Courier New, monospace',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('font-family="Courier New, monospace"');
  });

  it('table renders font-family when specified', () => {
    const block = createTableBlock({
      fontFamily: 'Times New Roman, serif',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('font-family="Times New Roman, serif"');
  });
});
