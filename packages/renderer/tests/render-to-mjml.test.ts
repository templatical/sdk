import { describe, expect, it } from 'vitest';
import {
  createDefaultTemplateContent,
  createTextBlock,
  createSectionBlock,
  createImageBlock,
} from '@templatical/types';
import { renderToMjml } from '../src';

describe('renderToMjml', () => {
  it('renders empty template', () => {
    const content = createDefaultTemplateContent();
    const mjml = renderToMjml(content);
    expect(mjml).toContain('<mjml>');
    expect(mjml).toContain('</mjml>');
    expect(mjml).toContain('<mj-body');
    expect(mjml).toContain('width="600px"');
    expect(mjml).toContain('background-color="#ffffff"');
    expect(mjml).toContain('font-family="Arial, sans-serif"');
  });

  it('renders blocks inside body', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createTextBlock({ content: '<p>Hello World</p>' })];
    const mjml = renderToMjml(content);
    expect(mjml).toContain('Hello World');
    expect(mjml).toContain('<mj-text');
  });

  it('wraps non-section blocks in section/column', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createTextBlock({ content: '<p>Test</p>' })];
    const mjml = renderToMjml(content);
    expect(mjml).toContain('<mj-section>');
    expect(mjml).toContain('<mj-column>');
  });

  it('renders section blocks directly', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        children: [[createTextBlock({ content: '<p>In section</p>' })]],
      }),
    ];
    const mjml = renderToMjml(content);
    expect(mjml).toContain('In section');
  });

  it('adds preheader text', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'Check this out!';
    const mjml = renderToMjml(content);
    expect(mjml).toContain('<mj-preview>Check this out!</mj-preview>');
  });

  it('adds custom font declarations', () => {
    const content = createDefaultTemplateContent();
    const mjml = renderToMjml(content, {
      customFonts: [{ name: 'Inter', url: 'https://fonts.example.com/inter.css' }],
    });
    expect(mjml).toContain('<mj-font name="Inter" href="https://fonts.example.com/inter.css"');
  });

  it('includes visibility media queries', () => {
    const content = createDefaultTemplateContent();
    const mjml = renderToMjml(content);
    expect(mjml).toContain('tpl-hide-mobile');
    expect(mjml).toContain('tpl-hide-tablet');
    expect(mjml).toContain('tpl-hide-desktop');
  });

  it('wraps blocks with display conditions', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createTextBlock({
        content: '<p>Conditional</p>',
        displayCondition: {
          label: 'VIP',
          before: '{% if vip %}',
          after: '{% endif %}',
        },
      }),
    ];
    const mjml = renderToMjml(content);
    expect(mjml).toContain('<mj-raw>{% if vip %}</mj-raw>');
    expect(mjml).toContain('<mj-raw>{% endif %}</mj-raw>');
    expect(mjml).toContain('Conditional');
  });

  it('filters html blocks when not allowed', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createTextBlock({ content: '<p>Keep</p>' }),
      { id: '1', type: 'html' as const, content: '<div>Remove</div>', styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
    ];
    const mjml = renderToMjml(content, { allowHtmlBlocks: false });
    expect(mjml).toContain('Keep');
    expect(mjml).not.toContain('Remove');
  });

  it('renders with width=0', () => {
    const content = createDefaultTemplateContent();
    content.settings.width = 0;
    const mjml = renderToMjml(content);
    expect(mjml).toContain('width="0px"');
    expect(mjml).toContain('<mjml>');
  });

  it('renders with very large width', () => {
    const content = createDefaultTemplateContent();
    content.settings.width = 9999;
    const mjml = renderToMjml(content);
    expect(mjml).toContain('width="9999px"');
  });

  it('renders with empty blocks array', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [];
    const mjml = renderToMjml(content);
    expect(mjml).toContain('<mj-body');
    expect(mjml).toContain('</mj-body>');
    expect(mjml).not.toContain('<mj-text');
  });

  it('does not add preview tag for empty preheader text', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = '';
    const mjml = renderToMjml(content);
    expect(mjml).not.toContain('<mj-preview>');
  });

  it('does not add preview tag for whitespace-only preheader text', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = '   ';
    const mjml = renderToMjml(content);
    expect(mjml).not.toContain('<mj-preview>');
  });

  it('trims preheader text', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = '  Hello World  ';
    const mjml = renderToMjml(content);
    expect(mjml).toContain('<mj-preview>Hello World</mj-preview>');
  });

  it('escapes HTML in preheader text', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'Sale <50% off> & more';
    const mjml = renderToMjml(content);
    expect(mjml).toContain('<mj-preview>Sale &lt;50% off&gt; &amp; more</mj-preview>');
  });

  it('handles very long preheader text', () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'A'.repeat(500);
    const mjml = renderToMjml(content);
    expect(mjml).toContain(`<mj-preview>${'A'.repeat(500)}</mj-preview>`);
  });

  it('does not add preview tag when preheaderText is undefined', () => {
    const content = createDefaultTemplateContent();
    // preheaderText is optional and undefined by default
    expect(content.settings.preheaderText).toBeUndefined();
    const mjml = renderToMjml(content);
    expect(mjml).not.toContain('<mj-preview>');
  });

  it('skips blocks that render to empty string', () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createTextBlock({
        content: '<p>Visible</p>',
      }),
      createTextBlock({
        content: '<p>Hidden</p>',
        visibility: { desktop: false, tablet: false, mobile: false },
      }),
    ];
    const mjml = renderToMjml(content);
    expect(mjml).toContain('Visible');
    expect(mjml).not.toContain('Hidden');
  });
});
