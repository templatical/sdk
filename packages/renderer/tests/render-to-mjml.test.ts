import { describe, expect, it } from 'vitest';
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createImageBlock,
  createSocialIconsBlock,
} from '@templatical/types';
import { renderToMjml, DEFAULT_SOCIAL_ICONS_BASE_URL } from '../src';

describe('renderToMjml', () => {
  it('renders empty template', async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en">');
    expect(mjml).toContain('</mjml>');
    expect(mjml).toContain('<mj-body');
    expect(mjml).toContain('width="600px"');
    expect(mjml).toContain('background-color="#ffffff"');
    expect(mjml).toContain('font-family="Arial, sans-serif"');
  });

  it('renders blocks inside body', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: '<p>Hello World</p>' })];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('Hello World');
    expect(mjml).toContain('<mj-text');
  });

  it('wraps non-section blocks in section/column', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: '<p>Test</p>' })];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-section>');
    expect(mjml).toContain('<mj-column>');
  });

  it('renders section blocks directly', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        children: [[createParagraphBlock({ content: '<p>In section</p>' })]],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('In section');
  });

  it('adds preheader text', async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'Check this out!';
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-preview>Check this out!</mj-preview>');
  });

  it('adds custom font declarations', async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content, {
      customFonts: [{ name: 'Inter', url: 'https://fonts.example.com/inter.css' }],
    });
    expect(mjml).toContain('<mj-font name="Inter" href="https://fonts.example.com/inter.css"');
  });

  it('includes visibility media queries', async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('tpl-hide-mobile');
    expect(mjml).toContain('tpl-hide-desktop');
    expect(mjml).not.toContain('tpl-hide-tablet');
  });

  it('wraps blocks with display conditions', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({
        content: '<p>Conditional</p>',
        displayCondition: {
          label: 'VIP',
          before: '{% if vip %}',
          after: '{% endif %}',
        },
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-raw>{% if vip %}</mj-raw>');
    expect(mjml).toContain('<mj-raw>{% endif %}</mj-raw>');
    expect(mjml).toContain('Conditional');
  });

  it('wraps display conditions on blocks nested inside a section column', async () => {
    const content = createDefaultTemplateContent();
    const conditional = createParagraphBlock({
      content: '<p>VIP only</p>',
      displayCondition: {
        label: 'VIP',
        before: '{% if vip %}',
        after: '{% endif %}',
      },
    });
    const section = createSectionBlock({
      columns: '2',
      children: [
        [conditional],
        [createParagraphBlock({ content: '<p>Everyone</p>' })],
      ],
    });
    content.blocks = [section];

    const mjml = await renderToMjml(content);

    // The nested block must emit the same liquid guards as a top-level block;
    // otherwise conditional content inside a multi-column layout renders
    // unconditionally for every recipient.
    expect(mjml).toContain('<mj-raw>{% if vip %}</mj-raw>');
    expect(mjml).toContain('<mj-raw>{% endif %}</mj-raw>');
    expect(mjml).toContain('VIP only');
    // The non-conditional sibling stays ungated.
    expect(mjml).toContain('Everyone');
  });

  it('filters html blocks when not allowed', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({ content: '<p>Keep</p>' }),
      { id: '1', type: 'html' as const, content: '<div>Remove</div>', styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } } },
    ];
    const mjml = await renderToMjml(content, { allowHtmlBlocks: false });
    expect(mjml).toContain('Keep');
    expect(mjml).not.toContain('Remove');
  });

  it('renders with width=0', async () => {
    const content = createDefaultTemplateContent();
    content.settings.width = 0;
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('width="0px"');
    expect(mjml).toContain('<mjml lang="en">');
  });

  it('renders with very large width', async () => {
    const content = createDefaultTemplateContent();
    content.settings.width = 9999;
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('width="9999px"');
  });

  it('renders with empty blocks array', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en">');
    expect(mjml).toContain('<mj-body');
    expect(mjml).toContain('</mj-body>');
    expect(mjml).toContain('</mjml>');
    // <mj-attributes> may contain `<mj-text font-size="..." />` defaults
    // — assert only on the body.
    const body = mjml.replace(/<mj-attributes>[\s\S]*?<\/mj-attributes>/, '');
    expect(body).not.toContain('<mj-text');
  });

  it('does not add preview tag for empty preheader text', async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = '';
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en">');
    expect(mjml).toContain('<mj-body');
    expect(mjml).not.toContain('<mj-preview>');
  });

  it('does not add preview tag for whitespace-only preheader text', async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = '   ';
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en">');
    expect(mjml).toContain('<mj-body');
    expect(mjml).not.toContain('<mj-preview>');
  });

  it('trims preheader text', async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = '  Hello World  ';
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-preview>Hello World</mj-preview>');
  });

  it('escapes HTML in preheader text', async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'Sale <50% off> & more';
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-preview>Sale &lt;50% off&gt; &amp; more</mj-preview>');
  });

  it('handles very long preheader text', async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = 'A'.repeat(500);
    const mjml = await renderToMjml(content);
    expect(mjml).toContain(`<mj-preview>${'A'.repeat(500)}</mj-preview>`);
  });

  it('does not add preview tag when preheaderText is undefined', async () => {
    const content = createDefaultTemplateContent();
    // preheaderText is optional and undefined by default
    expect(content.settings.preheaderText).toBeUndefined();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en">');
    expect(mjml).toContain('<mj-body');
    expect(mjml).not.toContain('<mj-preview>');
  });

  it('skips blocks that render to empty string', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({
        content: '<p>Visible</p>',
      }),
      createParagraphBlock({
        content: '<p>Hidden</p>',
        visibility: { desktop: false, mobile: false },
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('Visible');
    expect(mjml).not.toContain('Hidden');
  });

  it('emits mjml lang attribute from settings.locale', async () => {
    const content = createDefaultTemplateContent();
    content.settings.locale = 'de';
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="de">');
  });

  it('uses the default locale ("en") for new templates', async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en">');
  });

  it('escapes locale value in lang attribute', async () => {
    const content = createDefaultTemplateContent();
    content.settings.locale = 'en"><script>';
    const mjml = await renderToMjml(content);
    expect(mjml).not.toContain('<script>');
    expect(mjml).toContain('lang="en&quot;&gt;&lt;script&gt;"');
  });

  it('renders decorative image with empty alt and role=presentation', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createImageBlock({
        src: 'https://example.com/spacer.png',
        alt: 'ignored',
        decorative: true,
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('alt=""');
    expect(mjml).not.toContain('alt="ignored"');
    expect(mjml).toContain('role="presentation"');
  });

  it('uses default unpkg URL for social icons', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSocialIconsBlock({
        icons: [{ platform: 'facebook', url: 'https://facebook.com' }],
        iconStyle: 'circle',
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain(
      `src="${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/facebook.png"`,
    );
  });

  it('honors socialIconsBaseUrl option', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSocialIconsBlock({
        icons: [{ platform: 'twitter', url: 'https://twitter.com' }],
        iconStyle: 'solid',
      }),
    ];
    const mjml = await renderToMjml(content, {
      socialIconsBaseUrl: 'https://cdn.example.com/social',
    });
    expect(mjml).toContain(
      'src="https://cdn.example.com/social/solid/twitter.png"',
    );
  });

  it('strips trailing slash from socialIconsBaseUrl', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSocialIconsBlock({
        icons: [{ platform: 'github', url: 'https://github.com' }],
        iconStyle: 'square',
      }),
    ];
    const mjml = await renderToMjml(content, {
      socialIconsBaseUrl: 'https://cdn.example.com/social/',
    });
    expect(mjml).toContain(
      'src="https://cdn.example.com/social/square/github.png"',
    );
    expect(mjml).not.toContain('//square/');
  });

  it('renders non-decorative image preserving alt and omitting role', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createImageBlock({
        src: 'https://example.com/hero.png',
        alt: 'Spring sale',
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('alt="Spring sale"');
    expect(mjml).not.toContain('role="presentation"');
  });
});
