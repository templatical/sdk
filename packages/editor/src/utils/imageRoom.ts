import type {
  Block,
  BorderValue,
  ColumnLayout,
  SpacingValue,
  TemplateContent,
} from "@templatical/types";
import {
  applyLayout,
  isSection,
  isWrapper,
  toBorderCss,
} from "@templatical/types";

/**
 * Column percentages per layout, exactly as the renderer's
 * `getWidthPercentages` emits them. MJML sizes a column from the emitted
 * string, so 33.33% of 600 is 199, not a third. The parity test in
 * `tests/imageRoom.test.ts` holds this table to the renderer's.
 */
const COLUMN_PERCENTS: Record<ColumnLayout, number[]> = {
  "1": [100],
  "2": [50, 50],
  "3": [33.33, 33.33, 33.34],
  "1-2": [33.33, 66.67],
  "2-1": [66.67, 33.33],
};

/** Side padding plus drawn side borders: what MJML takes off a box's content. */
function horizontalInset(
  padding: SpacingValue | undefined,
  border?: BorderValue,
): number {
  const drawn = (side: BorderValue["left"] | undefined) =>
    toBorderCss(side) === null ? 0 : side!.width;
  return (
    (padding?.left ?? 0) +
    (padding?.right ?? 0) +
    drawn(border?.left) +
    drawn(border?.right)
  );
}

function blockRoom(block: Block, columnContent: number): number {
  const border = "border" in block ? (block.border as BorderValue) : undefined;
  return (
    Math.floor(columnContent) - horizontalInset(block.styles.padding, border)
  );
}

function findRoom(
  blocks: Block[],
  blockId: string,
  contentWidth: number,
): number | null {
  for (const block of blocks) {
    if (isWrapper(block)) {
      const inner =
        Math.floor(contentWidth) - horizontalInset(block.styles.padding);
      const found = findRoom(block.children, blockId, inner);
      if (found !== null) return found;
      continue;
    }

    if (isSection(block)) {
      const banded = block.wrapper
        ? Math.floor(contentWidth) - horizontalInset(block.wrapper.padding)
        : contentWidth;
      const sectionBox =
        Math.floor(banded) -
        horizontalInset(block.styles.padding, block.border);
      const percents = COLUMN_PERCENTS[block.columns] ?? [100];
      for (let index = 0; index < block.children.length; index++) {
        const column = Math.floor(
          (sectionBox * (percents[index] ?? 100)) / 100,
        );
        const child = block.children[index].find((c) => c.id === blockId);
        if (child) return blockRoom(child, column);
      }
      continue;
    }

    // A top-level leaf renders in a default section with no padding.
    if (block.id === blockId) return blockRoom(block, contentWidth);
  }
  return null;
}

/**
 * The px an image can span on desktop: what MJML gives its column's content,
 * less the image's own side padding and drawn side borders. It mirrors the
 * renderer's `RenderContext.contentWidth` and `fluidOnMobileAttr`, so a width
 * at or above it renders as `"full"` does. The layout shell (`init({ layout })`)
 * is applied first, as the export does; a layout that fails to apply is
 * ignored. `null` when the block is not in the content.
 */
export function imageRoom(
  content: TemplateContent,
  blockId: string,
  layout?: TemplateContent,
): number | null {
  let doc = content;
  if (layout) {
    try {
      doc = applyLayout(layout, content);
    } catch {
      doc = content;
    }
  }
  return findRoom(doc.blocks, blockId, doc.settings.width);
}
