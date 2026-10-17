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
  resolveHero,
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

/** What an `mj-wrapper` band leaves its content: floored, less its side padding. */
function insideBand(width: number, padding: SpacingValue | undefined): number {
  return Math.floor(width) - horizontalInset(padding);
}

function blockRoom(block: Block, columnContent: number): number {
  const border = "border" in block ? (block.border as BorderValue) : undefined;
  return (
    Math.floor(columnContent) - horizontalInset(block.styles.padding, border)
  );
}

/**
 * Each section and top-level leaf in `blocks`, with the width the bands around
 * it leave it: every layout wrapper's and the section's own `wrapper`'s side
 * padding taken off, floored at each band as the renderer's `insideWrapper`
 * does.
 */
function* bandedBlocks(
  blocks: Block[],
  width: number,
): Generator<{ block: Block; bandWidth: number }> {
  for (const block of blocks) {
    if (isWrapper(block)) {
      yield* bandedBlocks(
        block.children,
        insideBand(width, block.styles.padding),
      );
      continue;
    }
    const bandWidth =
      isSection(block) && block.wrapper
        ? insideBand(width, block.wrapper.padding)
        : width;
    yield { block, bandWidth };
  }
}

/**
 * The content with the layout shell (`init({ layout })`) applied, as the
 * export does; a layout that fails to apply is ignored.
 */
function documentOf(
  content: TemplateContent,
  layout: TemplateContent | undefined,
): TemplateContent {
  if (!layout) return content;
  try {
    return applyLayout(layout, content);
  } catch {
    return content;
  }
}

/**
 * The px an image can span on desktop: what MJML gives its column's content,
 * less the image's own side padding and drawn side borders. It mirrors the
 * renderer's `RenderContext.contentWidth` and `fluidOnMobileAttr`, so a width
 * at or above it renders as `"full"` does. A hero's content takes the box
 * less the hero's padding only: the hero hides its section's border. `null`
 * when the block is not in the content.
 */
export function imageRoom(
  content: TemplateContent,
  blockId: string,
  layout?: TemplateContent,
): number | null {
  const doc = documentOf(content, layout);
  for (const { block, bandWidth } of bandedBlocks(
    doc.blocks,
    doc.settings.width,
  )) {
    if (isSection(block)) {
      const border = resolveHero(block)?.applied ? undefined : block.border;
      const sectionBox =
        Math.floor(bandWidth) - horizontalInset(block.styles.padding, border);
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
    if (block.id === blockId) return blockRoom(block, bandWidth);
  }
  return null;
}

/**
 * The width the bands around a top-level section leave it, which is the box
 * MJML draws a hero at and Outlook paints its image across: the body width
 * less the side padding of every layout wrapper and of the section's own
 * `wrapper`, floored at each band. `null` when the section is not in the
 * content.
 */
export function sectionBandWidth(
  content: TemplateContent,
  sectionId: string,
  layout?: TemplateContent,
): number | null {
  const doc = documentOf(content, layout);
  for (const { block, bandWidth } of bandedBlocks(
    doc.blocks,
    doc.settings.width,
  )) {
    if (block.id === sectionId) return Math.floor(bandWidth);
  }
  return null;
}
