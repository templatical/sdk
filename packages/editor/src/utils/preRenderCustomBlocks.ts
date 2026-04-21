import type { Block, CustomBlock, TemplateContent } from "@templatical/types";
import { isCustomBlock } from "@templatical/types";
import type { UseBlockRegistryReturn } from "../composables/useBlockRegistry";

/**
 * Renders every custom block in the content tree to its HTML representation
 * and stores the result on `block.renderedHtml`. Called before save so the
 * backend can include custom-block output in its MJML export.
 *
 * Failures per-block are swallowed (and replaced with a comment placeholder)
 * so one broken block doesn't block the save of the rest.
 */
export async function preRenderCustomBlocks(
  content: TemplateContent,
  registry: UseBlockRegistryReturn,
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
