import type { TemplateContent } from "@templatical/types";
import {
  isButton,
  isHtml,
  isImage,
  isMenu,
  isParagraph,
  isSocialIcons,
  isTitle,
  isVideo,
} from "@templatical/types";
import { walkBlocks } from "./walk";
import { extractAnchors } from "./html-utils";

export type UrlSource =
  | "anchor"
  | "button"
  | "image-link"
  | "video"
  | "menu-item"
  | "social-icon";

export interface UrlOccurrence {
  url: string;
  blockId: string;
  source: UrlSource;
  /** Anchor text or block-derived label, if applicable. */
  label?: string;
}

/**
 * Visit every URL-bearing field in the template tree.
 *
 * Sources covered:
 *  - anchor      — `<a href>` inside `title.content`, `paragraph.content`,
 *                  `html.content` (parsed via extractAnchors)
 *  - button      — `button.url`
 *  - image-link  — `image.linkUrl` (only when present + non-empty)
 *  - video       — `video.url`
 *  - menu-item   — `menu.items[i].url`
 *  - social-icon — `social.icons[i].url`
 *
 * Each rule iterates this list once and decides per occurrence.
 */
export function walkUrls(content: TemplateContent): UrlOccurrence[] {
  const occurrences: UrlOccurrence[] = [];

  walkBlocks(content, (block) => {
    if (isTitle(block) || isParagraph(block) || isHtml(block)) {
      for (const anchor of extractAnchors(block.content)) {
        occurrences.push({
          url: anchor.href,
          blockId: block.id,
          source: "anchor",
          label: anchor.text,
        });
      }
      return;
    }

    if (isButton(block)) {
      occurrences.push({
        url: block.url,
        blockId: block.id,
        source: "button",
        label: block.text,
      });
      return;
    }

    if (isImage(block)) {
      if (block.linkUrl && block.linkUrl !== "") {
        occurrences.push({
          url: block.linkUrl,
          blockId: block.id,
          source: "image-link",
          label: block.alt || undefined,
        });
      }
      return;
    }

    if (isVideo(block)) {
      occurrences.push({
        url: block.url,
        blockId: block.id,
        source: "video",
        label: block.alt || undefined,
      });
      return;
    }

    if (isMenu(block)) {
      for (const item of block.items) {
        occurrences.push({
          url: item.url,
          blockId: block.id,
          source: "menu-item",
          label: item.text,
        });
      }
      return;
    }

    if (isSocialIcons(block)) {
      for (const icon of block.icons) {
        occurrences.push({
          url: icon.url,
          blockId: block.id,
          source: "social-icon",
          label: icon.platform,
        });
      }
      return;
    }
  });

  return occurrences;
}
