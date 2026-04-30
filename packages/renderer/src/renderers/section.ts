import type { Block, SectionBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { getWidthPercentages, getWidthPixels } from "../columns";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * A function type that renders a single block to MJML markup.
 */
export type BlockRenderer = (block: Block, context: RenderContext) => string;

/**
 * Render a section block with columns to MJML markup.
 */
export function renderSection(
  block: SectionBlock,
  context: RenderContext,
  renderBlock: BlockRenderer,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const columnsLayout = block.columns;
  const columnWidths = getWidthPercentages(columnsLayout);
  const columnWidthsPx = getWidthPixels(columnsLayout, context.containerWidth);
  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "native");
  const visibilityAttr = getCssClassAttr(block);

  const children = block.children;
  const columnsContent: string[] = [];

  for (let index = 0; index < children.length; index++) {
    const column = children[index];
    const width = columnWidths[index] ?? "100%";
    const columnWidth = Math.floor(
      columnWidthsPx[index] ?? context.containerWidth,
    );

    const filteredColumn = filterHtmlBlocks(column, context.allowHtmlBlocks);
    const columnContext = context.withContainerWidth(columnWidth);

    const columnBlocks = filteredColumn
      .map((child) => renderBlock(child, columnContext))
      .filter((value) => value !== "")
      .join("\n");

    const content =
      columnBlocks === "" ? "<mj-text>&nbsp;</mj-text>" : columnBlocks;

    columnsContent.push(`<mj-column width="${width}">
${content}
</mj-column>`);
  }

  const columns = columnsContent.join("\n");

  return `<mj-section${bgColor} padding="${padding}"${visibilityAttr}>
${columns}
</mj-section>`;
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
