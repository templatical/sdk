import type {
  Block,
  CustomBlock,
  TemplateContent,
  CustomFont,
} from "@templatical/types";
import { isSection, isCustomBlock } from "@templatical/types";
import { RenderContext } from "./render-context";
import { renderBlock } from "./renderers";
import { escapeHtml, escapeAttr } from "./escape";

export interface RenderOptions {
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;
  /**
   * Resolves custom blocks to their HTML representation. Called once per
   * custom block in the content tree before MJML rendering. The renderer
   * has no built-in knowledge of how to render custom blocks; consumers
   * provide this function.
   *
   * Editor consumers: pass `editor.renderCustomBlock`.
   *
   * Headless consumers (Node.js, server, CLI): provide your own resolver,
   * typically using the same liquid template + field values pipeline as
   * the editor uses. If omitted, custom blocks fall back to
   * `block.renderedHtml` (if present) and otherwise are omitted from the
   * output.
   */
  renderCustomBlock?: (block: CustomBlock) => Promise<string>;
}

/**
 * Render template content to an MJML string.
 *
 * The function is async because resolving custom blocks may require
 * asynchronous work (e.g., the editor's liquid renderer dynamically imports
 * `liquidjs`). When the content has no custom blocks or `renderCustomBlock`
 * is omitted, no async work is performed but the function still resolves
 * synchronously — i.e., it always returns a Promise.
 */
export async function renderToMjml(
  content: TemplateContent,
  options?: RenderOptions,
): Promise<string> {
  const customFonts = options?.customFonts ?? [];
  const defaultFallbackFont =
    options?.defaultFallbackFont ?? "Arial, sans-serif";
  const allowHtmlBlocks = options?.allowHtmlBlocks ?? true;

  const customBlockHtml = await resolveCustomBlocks(
    content,
    options?.renderCustomBlock,
  );

  const renderContext = new RenderContext(
    content.settings.width,
    customFonts,
    defaultFallbackFont,
    allowHtmlBlocks,
    customBlockHtml,
  );

  const blocks = filterHtmlBlocks(content.blocks, allowHtmlBlocks);
  const fontFamily = renderContext.resolveFontFamily(
    content.settings.fontFamily,
  );
  const backgroundColor = content.settings.backgroundColor;

  const bodyContent = blocks
    .map((block) => renderTopLevelBlock(block, renderContext))
    .filter((value) => value !== "")
    .join("\n");

  const fontDeclarations = generateFontDeclarations(customFonts);
  const previewTag = generatePreviewTag(content.settings.preheaderText);

  return `<mjml>
  <mj-head>${previewTag}
    <mj-attributes>
      <mj-all font-family="${fontFamily}" />
      <mj-text font-size="14px" />
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
  if (rendered === "") {
    return "";
  }

  const displayCondition = block.displayCondition;

  if (!displayCondition) {
    return rendered;
  }

  return (
    `<mj-raw>${displayCondition.before}</mj-raw>` +
    "\n" +
    rendered +
    "\n" +
    `<mj-raw>${displayCondition.after}</mj-raw>`
  );
}

/**
 * Wrap block content in a default mj-section/mj-column for non-section blocks.
 */
function wrapInSection(content: string): string {
  if (content === "") {
    return "";
  }

  return `<mj-section>
  <mj-column>
${content}
  </mj-column>
</mj-section>`;
}

function generatePreviewTag(preheaderText?: string): string {
  if (!preheaderText) {
    return "";
  }

  const trimmed = preheaderText.trim();

  if (trimmed === "") {
    return "";
  }

  const escaped = escapeHtml(trimmed);

  return `\n    <mj-preview>${escaped}</mj-preview>`;
}

function generateFontDeclarations(customFonts: CustomFont[]): string {
  if (customFonts.length === 0) {
    return "";
  }

  return customFonts
    .map(
      (font) =>
        `\n    <mj-font name="${escapeAttr(font.name)}" href="${escapeAttr(font.url)}" />`,
    )
    .join("");
}

/**
 * Filter out HTML blocks if they are not allowed.
 */
function filterHtmlBlocks(blocks: Block[], allowHtmlBlocks: boolean): Block[] {
  if (allowHtmlBlocks) {
    return blocks;
  }

  return blocks.filter((block) => block.type !== "html");
}

/**
 * Walk the content tree, collect every custom block, then resolve each in
 * parallel via the supplied callback. Returns a map keyed by block id that
 * the synchronous render pass reads from. If no callback is provided, returns
 * an empty map and the sync pass falls back to `block.renderedHtml`.
 *
 * Per-block failures bubble up — the caller decides whether to swallow or
 * rethrow. We don't replace failures with placeholders here because that's
 * a policy decision (the editor swallows; a strict CLI may want to fail).
 */
async function resolveCustomBlocks(
  content: TemplateContent,
  renderCustomBlock: RenderOptions["renderCustomBlock"],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (!renderCustomBlock) {
    return result;
  }

  const customBlocks: CustomBlock[] = [];
  collectCustomBlocks(content.blocks, customBlocks);

  if (customBlocks.length === 0) {
    return result;
  }

  const rendered = await Promise.all(
    customBlocks.map((block) => renderCustomBlock(block)),
  );

  for (let index = 0; index < customBlocks.length; index++) {
    result.set(customBlocks[index].id, rendered[index]);
  }

  return result;
}

function collectCustomBlocks(blocks: Block[], out: CustomBlock[]): void {
  for (const block of blocks) {
    if (isCustomBlock(block)) {
      out.push(block);
      continue;
    }

    if (isSection(block)) {
      for (const column of block.children) {
        collectCustomBlocks(column, out);
      }
    }
  }
}

// Re-export utilities for consumers
export { RenderContext } from "./render-context";
export { escapeHtml, escapeAttr, convertMergeTagsToValues } from "./escape";
export { isHiddenOnAll, getCssClassAttr, getCssClasses } from "./visibility";
export { getWidthPercentages, getWidthPixels } from "./columns";
export { toPaddingString } from "./padding";
export { SOCIAL_ICONS, generateSocialIconDataUri } from "./social-icons";
export { renderBlock } from "./renderers";
export type { BlockRenderer } from "./renderers/section";
