import type { Block, CustomBlock, TemplateContent } from "@templatical/types";
import { isCustomBlock } from "@templatical/types";

/**
 * The only thing this needs from the block registry. Named as a slice rather than
 * taking `UseBlockRegistryReturn` so the render-payload builder can supply the
 * editor instance's own `renderCustomBlock` without reaching for the registry.
 */
export interface CustomBlockResolver {
  renderCustomBlock: (block: CustomBlock) => Promise<string>;
}

/**
 * Renders every custom block in the content tree to its HTML representation
 * and stores the result on `block.renderedHtml`.
 *
 * **A contract obligation of every render, not a save-path detail.** A renderer
 * handed a custom block with neither a resolver nor `renderedHtml` omits it from
 * the output silently, and a backend has no way to resolve one: the HTML comes
 * from the consumer's liquid template plus the block's field values, and the
 * definition is registered in the browser. So this runs before a
 * `RenderProvider` sees the content, and before Cloud persists it.
 *
 * Failures per-block are swallowed (and replaced with a comment placeholder)
 * so one broken block doesn't block the save of the rest.
 */
export async function preRenderCustomBlocks(
  content: TemplateContent,
  registry: CustomBlockResolver,
): Promise<void> {
  const renderBlock = async (block: Block): Promise<void> => {
    if (isCustomBlock(block)) {
      const customBlock = block as CustomBlock;
      try {
        customBlock.renderedHtml =
          await registry.renderCustomBlock(customBlock);
      } catch {
        customBlock.renderedHtml = `<!-- Custom block render error: ${customBlock.customType} -->`;
      }
    }

    if (block.type === "section" && "children" in block) {
      const sectionBlock = block as { children: Block[][] };
      for (const column of sectionBlock.children) {
        for (const child of column) {
          await renderBlock(child);
        }
      }
    }
  };

  for (const block of content.blocks) {
    await renderBlock(block);
  }
}
