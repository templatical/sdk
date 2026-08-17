import type { Block } from "@templatical/types";
import {
  isSection,
  isTitle,
  isParagraph,
  isImage,
  isButton,
  isDivider,
  isSpacer,
  isHtml,
  isSocialIcons,
  isMenu,
  isTable,
  isVideo,
  isCustomBlock,
} from "@templatical/types";
import type { RenderContext } from "../render-context";
import { isHiddenOnAll } from "../visibility";
import { renderUnrenderableBlock } from "../unrenderable";
import { renderTitle } from "./title";
import { renderParagraph } from "./paragraph";
import { renderImage } from "./image";
import { renderButton } from "./button";
import { renderDivider } from "./divider";
import { renderSpacer } from "./spacer";
import { renderHtml } from "./html";
import { renderSocialIcons } from "./social";
import { renderMenu } from "./menu";
import { renderTable } from "./table";
import { renderCustom } from "./custom";
import { renderSection } from "./section";
import { renderVideo } from "./video";

/**
 * Render a single block to MJML markup.
 * Dispatches to the appropriate block-type renderer.
 *
 * A `blockRenderers` override for the block's type wins over the built-in
 * renderer — see {@link RenderContext.blockRenderers}. A type with neither gets a
 * placeholder marker plus a warning rather than disappearing.
 */
export function renderBlock(block: Block, context: RenderContext): string {
  // Checked first so an override replaces the built-in wholesale rather than
  // running after it. The override then owns everything the built-in did,
  // including the hidden-on-all-viewports early return.
  const override = context.blockRenderers[block.type];
  if (override) {
    return override(block, context);
  }

  if (isSection(block)) {
    return renderSection(block, context, renderBlock);
  }

  if (isTitle(block)) {
    return renderTitle(block, context);
  }

  if (isParagraph(block)) {
    return renderParagraph(block, context);
  }

  if (isImage(block)) {
    return renderImage(block, context);
  }

  if (isButton(block)) {
    return renderButton(block, context);
  }

  if (isDivider(block)) {
    return renderDivider(block, context);
  }

  if (isSpacer(block)) {
    return renderSpacer(block, context);
  }

  if (isHtml(block)) {
    return renderHtml(block, context);
  }

  if (isSocialIcons(block)) {
    return renderSocialIcons(block, context);
  }

  if (isMenu(block)) {
    return renderMenu(block, context);
  }

  if (isTable(block)) {
    return renderTable(block, context);
  }

  if (isVideo(block)) {
    return renderVideo(block, context);
  }

  if (isCustomBlock(block)) {
    return renderCustom(block, context);
  }

  // Nothing here knows how to render this type. A block the author hid on every
  // viewport is meant to produce nothing, so it still does — every built-in
  // renderer above makes the same call, and warning about a deliberate hide would
  // be noise. Everything else gets a marker: `countdown` today (Cloud renders it
  // server-side as an animated GIF, which no browser can do), and any future type
  // whose renderer hasn't landed yet.
  if (isHiddenOnAll(block)) {
    return "";
  }

  return renderUnrenderableBlock(block);
}
