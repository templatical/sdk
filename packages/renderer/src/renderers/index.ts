import type { Block } from "@templatical/types";
import {
  isSection,
  isText,
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
import { renderText } from "./text";
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
 */
export function renderBlock(block: Block, context: RenderContext): string {
  if (isSection(block)) {
    return renderSection(block, context, renderBlock);
  }

  if (isText(block)) {
    return renderText(block, context);
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

  // Countdown blocks are rendered by the Templatical Cloud backend.
  // In OSS mode they return empty — use initCloud() for full countdown support.
  return "";
}
