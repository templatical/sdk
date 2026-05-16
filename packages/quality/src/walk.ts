import type { Block, TemplateContent } from "@templatical/types";
import { isSection } from "@templatical/types";
import type { WalkContext } from "./types";
import { isOpaqueHex } from "./contrast";

export type Visitor = (block: Block, ctx: WalkContext) => void;

const DEFAULT_BG = "#ffffff";

/**
 * Pure traversal of the block tree. Calls `visit` once per block in
 * document order, providing a `WalkContext` that includes the resolved
 * background color (nearest opaque ancestor) and structural refs.
 *
 * Sections cannot nest (renderer enforces this), so the walker doesn't
 * descend into a section that lives inside a column. Custom blocks are
 * visited but not descended into.
 */
export function walkBlocks(content: TemplateContent, visit: Visitor): void {
  const rootBg = isOpaqueHex(content.settings.backgroundColor)
    ? content.settings.backgroundColor.toLowerCase()
    : DEFAULT_BG;

  const walk = (block: Block, ctx: WalkContext): void => {
    // A block's own opaque backgroundColor is what's behind its content —
    // visit it with that resolved bg so contrast rules compare against the
    // right surface. Falls back to the inherited section/template bg.
    const ownBg = block.styles?.backgroundColor;
    const effectiveBg = isOpaqueHex(ownBg)
      ? (ownBg as string).toLowerCase()
      : ctx.resolvedBackgroundColor;
    const blockCtx: WalkContext =
      effectiveBg === ctx.resolvedBackgroundColor
        ? ctx
        : { ...ctx, resolvedBackgroundColor: effectiveBg };

    visit(block, blockCtx);

    if (!isSection(block)) {
      return;
    }

    block.children.forEach((column, columnIndex) => {
      column.forEach((child) =>
        walk(child, {
          parent: block,
          section: block,
          columnIndex,
          depth: ctx.depth + 1,
          resolvedBackgroundColor: effectiveBg,
        }),
      );
    });
  };

  for (const block of content.blocks) {
    walk(block, {
      parent: null,
      section: null,
      columnIndex: null,
      depth: 0,
      resolvedBackgroundColor: rootBg,
    });
  }
}
