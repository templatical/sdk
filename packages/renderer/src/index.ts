import type {
  Block,
  CustomBlock,
  TemplateContent,
  CustomFont,
  SectionWrapper,
} from "@templatical/types";
import { isSection, isCustomBlock } from "@templatical/types";
import { RenderContext, DEFAULT_SOCIAL_ICONS_BASE_URL } from "./render-context";
import { renderBlock } from "./renderers";
import { escapeHtml, escapeAttr } from "./escape";
import { wrapWithDisplayCondition } from "./display-condition";
import { bgAttr } from "./utils";
import { toPaddingString } from "./padding";

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
  /**
   * Resolves the definition-level CSS for a custom block type. Called once
   * per unique `customType` present in the content tree (not per instance).
   * The non-empty results are deduped by content and emitted as additional
   * `<mj-style>` blocks inside `<mj-head>` alongside the built-in visibility
   * media queries.
   *
   * Editor consumers: pass a function that reads
   * `blockRegistry.getDefinition(customType)?.stylesheet`.
   *
   * Headless consumers: provide your own resolver, typically from the same
   * definitions map used by `renderCustomBlock`. Return `undefined` or `null`
   * for definitions without a stylesheet — those are skipped.
   */
  getCustomBlockStylesheet?: (customType: string) => string | undefined | null;
  /**
   * Base URL (no trailing slash) for the social icon PNG assets. Resolved to
   * `${baseUrl}/${style}/${platform}.png` per icon. Defaults to the
   * version-pinned unpkg mirror of this package. Override to self-host
   * (e.g., behind your own CDN or for air-gapped environments).
   *
   * Why PNGs: Outlook desktop (Word rendering engine) does not support SVG
   * and rejects base64 data URIs in `<img src>`, so social icons must be
   * served as raster images over HTTP for cross-client compatibility.
   */
  socialIconsBaseUrl?: string;
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
  const socialIconsBaseUrl = stripTrailingSlash(
    options?.socialIconsBaseUrl ?? DEFAULT_SOCIAL_ICONS_BASE_URL,
  );

  const customBlockHtml = await resolveCustomBlocks(
    content,
    options?.renderCustomBlock,
  );

  const customBlockStylesheets = collectCustomBlockStylesheets(
    content,
    options?.getCustomBlockStylesheet,
  );

  const renderContext = new RenderContext(
    content.settings.width,
    customFonts,
    defaultFallbackFont,
    allowHtmlBlocks,
    customBlockHtml,
    socialIconsBaseUrl,
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

  const lang = escapeAttr(content.settings.locale);

  return `<mjml lang="${lang}">
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
      @media only screen and (min-width: 481px) {
        .tpl-hide-desktop { display: none !important; mso-hide: all !important; }
      }
    </mj-style>${renderCustomBlockStylesheets(customBlockStylesheets)}
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
    // An empty render (hidden section) stays empty — never emit a bare wrapper.
    const framed =
      block.wrapper && rendered !== ""
        ? renderSectionWrapper(rendered, block.wrapper)
        : rendered;
    return wrapWithDisplayCondition(block, framed);
  }

  const content = renderBlock(block, context);
  const wrapped = wrapInSection(content);
  return wrapWithDisplayCondition(block, wrapped);
}

/**
 * Wrap a rendered section's `mj-section` in an `mj-wrapper` — a full-width band
 * (its own background + padding + optional radius) that frames the section.
 * `mj-wrapper` is the only MJML element that may contain `mj-section`.
 */
function renderSectionWrapper(inner: string, wrapper: SectionWrapper): string {
  const bg = bgAttr(wrapper.backgroundColor, "native");
  const padding = ` padding="${
    wrapper.padding ? toPaddingString(wrapper.padding) : "0"
  }"`;
  const radius =
    wrapper.borderRadius && wrapper.borderRadius > 0
      ? ` border-radius="${wrapper.borderRadius}px"`
      : "";
  return `<mj-wrapper${bg}${padding}${radius}>
${inner}
</mj-wrapper>`;
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

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
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

/**
 * Walk the content tree, find every unique `customType`, ask the consumer's
 * resolver for that definition's stylesheet, and return the non-empty,
 * content-deduped set in insertion order.
 *
 * Content-level dedupe (not just by customType) means two definitions that
 * happen to ship the same stylesheet string emit it only once — cheap and
 * matches the "one rule, emitted once" mental model. Whitespace-only and
 * empty stylesheets are skipped.
 */
function collectCustomBlockStylesheets(
  content: TemplateContent,
  resolver: RenderOptions["getCustomBlockStylesheet"],
): string[] {
  if (!resolver) {
    return [];
  }

  const customBlocks: CustomBlock[] = [];
  collectCustomBlocks(content.blocks, customBlocks);

  if (customBlocks.length === 0) {
    return [];
  }

  const seenTypes = new Set<string>();
  const seenContent = new Set<string>();
  const stylesheets: string[] = [];

  for (const block of customBlocks) {
    if (seenTypes.has(block.customType)) {
      continue;
    }
    seenTypes.add(block.customType);

    const css = resolver(block.customType);
    if (!css) {
      continue;
    }

    const trimmed = css.trim();
    if (trimmed === "" || seenContent.has(trimmed)) {
      continue;
    }
    seenContent.add(trimmed);
    stylesheets.push(trimmed);
  }

  return stylesheets;
}

function renderCustomBlockStylesheets(stylesheets: string[]): string {
  if (stylesheets.length === 0) {
    return "";
  }

  // One `<mj-style>` per unique stylesheet so per-definition CSS can be
  // independently inspected in the rendered MJML, and authors can grep their
  // contribution without disentangling a merged blob.
  return stylesheets
    .map((css) => `\n    <mj-style>\n${css}\n    </mj-style>`)
    .join("");
}

// Re-export utilities for consumers
export { RenderContext } from "./render-context";
export { escapeHtml, escapeAttr, convertMergeTagsToValues } from "./escape";
export { isHiddenOnAll, getCssClassAttr, getCssClasses } from "./visibility";
export { getWidthPercentages, getWidthPixels } from "./columns";
export { toPaddingString } from "./padding";
export { DEFAULT_SOCIAL_ICONS_BASE_URL } from "./render-context";
export { renderBlock } from "./renderers";
export type { BlockRenderer } from "./renderers/section";
