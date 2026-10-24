import type { Block, TemplateContent } from "@templatical/types";
import { htmlToPlainText } from "./aiRewritePreview";

function flatten(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) =>
    block.type === "section"
      ? flatten(block.children.flat())
      : block.type === "wrapper"
        ? flatten(block.children)
        : [block],
  );
}

function neighbours(
  blocks: readonly Block[],
  blockId: string,
): [string, string] {
  const index = blocks.findIndex((block) => block.id === blockId);
  const textOf = (block: Block): string => {
    if (block.type === "title" || block.type === "paragraph")
      return htmlToPlainText(block.content).trim();
    if (block.type === "button") return htmlToPlainText(block.text).trim();
    return "";
  };
  const before =
    blocks.slice(0, index).reverse().map(textOf).find(Boolean) ?? "";
  const after =
    blocks
      .slice(index + 1)
      .map(textOf)
      .find(Boolean) ?? "";
  return [before, after];
}

/** Read one image and its nearest text context, without changing the template. */
export function aiImageContext(
  content: TemplateContent,
  blockId: string,
): {
  url: string;
  currentAlt: string | null;
  linkHref: string | null;
  nearbyText: string;
} | null {
  function find(
    blocks: readonly Block[],
    section: readonly Block[],
  ): ReturnType<typeof aiImageContext> {
    for (const block of blocks) {
      if (block.id === blockId) {
        if (block.type !== "image" || !block.src) return null;
        const local = neighbours(flatten(blocks), blockId);
        const fallback = neighbours(flatten(section), blockId);
        return {
          url: block.src,
          currentAlt: block.decorative === true ? null : block.alt || null,
          linkHref: block.linkUrl || null,
          nearbyText: Array.from(
            [local[0] || fallback[0], local[1] || fallback[1]]
              .filter(Boolean)
              .join("\n"),
          )
            .slice(0, 2000)
            .join(""),
        };
      }
      if (block.type === "section") {
        for (const column of block.children) {
          const result = find(column, block.children.flat());
          if (result) return result;
        }
      } else if (block.type === "wrapper") {
        const result = find(block.children, section);
        if (result) return result;
      }
    }
    return null;
  }
  return find(content.blocks, content.blocks);
}

/** The exact image fields a reviewed draft is allowed to replace. */
export interface AiImageSnapshot {
  src: string;
  alt: string | null;
  decorative: boolean | null;
}
export function aiImageSnapshot(
  content: TemplateContent,
  blockId: string,
): AiImageSnapshot | null {
  const block = flatten(content.blocks).find(
    (candidate) => candidate.id === blockId,
  );
  return block?.type === "image"
    ? {
        src: block.src,
        alt: block.alt ?? null,
        decorative: block.decorative ?? null,
      }
    : null;
}
export function sameAiImage(
  current: AiImageSnapshot | null,
  captured: AiImageSnapshot | null,
): boolean {
  return (
    current !== null &&
    captured !== null &&
    current.src === captured.src &&
    current.alt === captured.alt &&
    current.decorative === captured.decorative
  );
}
