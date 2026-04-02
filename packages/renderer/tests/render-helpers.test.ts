import { describe, expect, it } from 'vitest';
import {
  createParagraphBlock,
  createHtmlBlock,
  createDefaultTemplateContent,
} from '@templatical/types';
import { renderToMjml } from '../src';

describe('renderToMjml helpers', () => {
  it('wraps a non-section block in mj-section and mj-column', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: '<p>Hello</p>' })];
    const result = renderToMjml(content);
    expect(result).toContain('<mj-section>');
    expect(result).toContain('<mj-column>');
    expect(result).toContain('<p>Hello</p>');
  });

  it('includes preheader text as mj-preview', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'Check out our sale!';
    const result = renderToMjml(content);
    expect(result).toContain('<mj-preview>Check out our sale!</mj-preview>');
  });

  it('excludes mj-preview when preheaderText is empty', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = '';
    const result = renderToMjml(content);
    expect(result).not.toContain('<mj-preview>');
  });

  it('excludes mj-preview when preheaderText is undefined', () => {
    const content = createDefaultTemplateContent();
    const result = renderToMjml(content);
    expect(result).not.toContain('<mj-preview>');
  });

  it('escapes HTML entities in preheader text', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'Sale <50% off> & more';
    const result = renderToMjml(content);
    expect(result).toContain('<mj-preview>Sale &lt;50% off&gt; &amp; more</mj-preview>');
  });

  it('includes custom font declarations as mj-font tags', () => {
    const content = createDefaultTemplateContent();
    const result = renderToMjml(content, {
      customFonts: [
        { name: 'Roboto', url: 'https://fonts.googleapis.com/css?family=Roboto' },
      ],
    });
    expect(result).toContain('<mj-font name="Roboto" href="https://fonts.googleapis.com/css?family=Roboto" />');
  });

  it('renders no mj-font tags when no custom fonts provided', () => {
    const content = createDefaultTemplateContent();
    const result = renderToMjml(content);
    expect(result).not.toContain('<mj-font');
  });

  it('filters out HTML blocks when allowHtmlBlocks is false', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({ content: '<p>Keep me</p>' }),
      createHtmlBlock({ content: '<div>Remove me</div>' }),
    ];
    const result = renderToMjml(content, { allowHtmlBlocks: false });
    expect(result).toContain('Keep me');
    expect(result).not.toContain('Remove me');
  });

  it('keeps HTML blocks when allowHtmlBlocks is true (default)', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createHtmlBlock({ content: '<div>Custom HTML</div>' }),
    ];
    const result = renderToMjml(content);
    expect(result).toContain('Custom HTML');
  });

  it('wraps blocks with display conditions in mj-raw', () => {
    const content = createDefaultTemplateContent();
    const block = createParagraphBlock({ content: '<p>Conditional</p>' });
    block.displayCondition = {
      before: '<!--[if mso]>',
      after: '<![endif]-->',
    };
    content.blocks = [block];
    const result = renderToMjml(content);
    expect(result).toContain('<mj-raw><!--[if mso]></mj-raw>');
    expect(result).toContain('<mj-raw><![endif]--></mj-raw>');
  });

  it('sets body width from template settings', () => {
    const content = createDefaultTemplateContent();
    content.settings.width = 700;
    const result = renderToMjml(content);
    expect(result).toContain('width="700px"');
  });

  it('sets body background color from template settings', () => {
    const content = createDefaultTemplateContent();
    content.settings.backgroundColor = '#f0f0f0';
    const result = renderToMjml(content);
    expect(result).toContain('background-color="#f0f0f0"');
  });

  it('sets default font family in mj-all attribute', () => {
    const content = createDefaultTemplateContent('Helvetica, sans-serif');
    const result = renderToMjml(content);
    expect(result).toContain('font-family="Helvetica, sans-serif"');
  });

  it('includes visibility media queries in mj-style', () => {
    const content = createDefaultTemplateContent();
    const result = renderToMjml(content);
    expect(result).toContain('.tpl-hide-mobile');
    expect(result).toContain('.tpl-hide-tablet');
    expect(result).toContain('.tpl-hide-desktop');
  });
});
