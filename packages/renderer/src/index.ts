import type { Block, TemplateContent, CustomFont } from '@templatical/types';
import { isSection } from '@templatical/types';
import { RenderContext } from './render-context';
import { renderBlock } from './renderers';
import { escapeHtml, escapeAttr } from './escape';

export interface RenderOptions {
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;
}

/**
 * Render template content to an MJML string.
 * This is the main entry point that matches the PHP MjmlRenderingService.export() output.
 */
export function renderToMjml(
  content: TemplateContent,
  options?: RenderOptions,
): string {
  const customFonts = options?.customFonts ?? [];
  const defaultFallbackFont = options?.defaultFallbackFont ?? 'Arial, sans-serif';
  const allowHtmlBlocks = options?.allowHtmlBlocks ?? true;

  const renderContext = new RenderContext(
    content.settings.width,
    customFonts,
    defaultFallbackFont,
    allowHtmlBlocks,
  );

  const blocks = filterHtmlBlocks(content.blocks, allowHtmlBlocks);
  const fontFamily = renderContext.resolveFontFamily(content.settings.fontFamily);
  const backgroundColor = content.settings.backgroundColor;

  const bodyContent = blocks
    .map((block) => renderTopLevelBlock(block, renderContext))
    .filter((value) => value !== '')
    .join('\n');

  const fontDeclarations = generateFontDeclarations(customFonts);
  const previewTag = generatePreviewTag(content.settings.preheaderText);

  return `<mjml>
  <mj-head>${previewTag}
    <mj-attributes>
      <mj-all font-family="${fontFamily}" />
      <mj-section padding="0" />
      <mj-column padding="0" />
      <mj-image fluid-on-mobile="true" />
    </mj-attributes>${fontDeclarations}
    <mj-style>
      a { color: inherit; text-decoration: none; }
      @media only screen and (max-width: 480px) {
        .tpl-hide-mobile { display: none !important; mso-hide: all !important; }
      }
      @media only screen and (min-width: 481px) and (max-width: 768px) {
        .tpl-hide-tablet { display: none !important; mso-hide: all !important; }
      }
      @media only screen and (min-width: 769px) {
        .tpl-hide-desktop { display: none !important; mso-hide: all !important; }
      }
    </mj-style>
  </mj-head>
  <mj-body width="${renderContext.containerWidth}px" background-color="${backgroundColor}">
${bodyContent}
  </mj-body>
</mjml>`;
}

/**
 * Render template content to an HTML string.
 * Dynamically imports the mjml package for MJML-to-HTML conversion.
 */
export async function renderToHtml(
  content: TemplateContent,
  options?: RenderOptions,
): Promise<string> {
  const mjml = renderToMjml(content, options);
  const { default: mjml2html } = await import('mjml');
  const { html } = mjml2html(mjml);
  return html;
}

/**
 * Render a top-level block. Sections are rendered directly,
 * non-section blocks are wrapped in a default section/column.
 */
function renderTopLevelBlock(block: Block, context: RenderContext): string {
  if (isSection(block)) {
    const rendered = renderBlock(block, context);
    return wrapWithDisplayCondition(block, rendered);
  }

  const content = renderBlock(block, context);
  const wrapped = wrapInSection(content);
  return wrapWithDisplayCondition(block, wrapped);
}

/**
 * Wrap rendered block content with display condition tags if present.
 */
function wrapWithDisplayCondition(block: Block, rendered: string): string {
  if (rendered === '') {
    return '';
  }

  const displayCondition = block.displayCondition;

  if (!displayCondition) {
    return rendered;
  }

  return (
    `<mj-raw>${displayCondition.before}</mj-raw>` +
    '\n' +
    rendered +
    '\n' +
    `<mj-raw>${displayCondition.after}</mj-raw>`
  );
}

/**
 * Wrap block content in a default mj-section/mj-column for non-section blocks.
 */
function wrapInSection(content: string): string {
  if (content === '') {
    return '';
  }

  return `<mj-section>
  <mj-column>
${content}
  </mj-column>
</mj-section>`;
}

function generatePreviewTag(preheaderText?: string): string {
  if (!preheaderText) {
    return '';
  }

  const trimmed = preheaderText.trim();

  if (trimmed === '') {
    return '';
  }

  const escaped = escapeHtml(trimmed);

  return `\n    <mj-preview>${escaped}</mj-preview>`;
}

function generateFontDeclarations(customFonts: CustomFont[]): string {
  if (customFonts.length === 0) {
    return '';
  }

  return customFonts
    .map(
      (font) =>
        `\n    <mj-font name="${escapeAttr(font.name)}" href="${escapeAttr(font.url)}" />`,
    )
    .join('');
}

/**
 * Filter out HTML blocks if they are not allowed.
 */
function filterHtmlBlocks(blocks: Block[], allowHtmlBlocks: boolean): Block[] {
  if (allowHtmlBlocks) {
    return blocks;
  }

  return blocks.filter((block) => block.type !== 'html');
}

// Re-export utilities for consumers
export { RenderContext } from './render-context';
export { escapeHtml, escapeAttr, convertMergeTagsToValues } from './escape';
export { isHiddenOnAll, getCssClassAttr, getCssClasses } from './visibility';
export { getWidthPercentages, getWidthPixels } from './columns';
export { toPaddingString } from './padding';
export { SOCIAL_ICONS, generateSocialIconDataUri } from './social-icons';
export { renderBlock } from './renderers';
export type { BlockRenderer } from './renderers/section';
