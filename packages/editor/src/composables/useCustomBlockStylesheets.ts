import { computed, type ComputedRef, type Ref } from "vue";
import type { Block, TemplateContent } from "@templatical/types";
import { isCustomBlock } from "@templatical/types";
import type { UseBlockRegistryReturn } from "./useBlockRegistry";

/**
 * Derive the reactive set of custom-block `stylesheet` strings currently in
 * use by the editor's content. Two layers of dedupe:
 *
 *  1. By `customType` — each definition's stylesheet is resolved once even if
 *     dozens of instances of that type exist in the template.
 *  2. By trimmed CSS content — two definitions that ship the same stylesheet
 *     string (unlikely but possible) emit it only once. Matches the renderer's
 *     `collectCustomBlockStylesheets` behavior so the editor preview and the
 *     exported MJML reflect the same rule set.
 *
 * Whitespace-only and missing stylesheets are filtered out. The result is a
 * `ComputedRef<string[]>` in insertion order (i.e., the order custom-block
 * types first appear in the content tree, depth-first through sections).
 *
 * Consumers render one `<style>` element per entry inside the editor's mount
 * root so the rules apply to the canvas. In shadow-DOM mode they scope to the
 * shadow root; in light-DOM mode they share the global stylesheet surface
 * already established by the published editor CSS — no new leak.
 */
export function useCustomBlockStylesheets(
  content: Ref<TemplateContent>,
  registry: UseBlockRegistryReturn,
): ComputedRef<string[]> {
  return computed(() => {
    const customTypes = collectUniqueCustomTypes(content.value.blocks);
    if (customTypes.size === 0) {
      return [];
    }

    const seenContent = new Set<string>();
    const out: string[] = [];

    for (const customType of customTypes) {
      const css = registry.getDefinition(customType)?.stylesheet;
      if (!css) continue;

      const trimmed = css.trim();
      if (trimmed === "" || seenContent.has(trimmed)) continue;

      seenContent.add(trimmed);
      out.push(trimmed);
    }

    return out;
  });
}

function collectUniqueCustomTypes(blocks: Block[]): Set<string> {
  const types = new Set<string>();
  walk(blocks, types);
  return types;
}

function walk(blocks: Block[], out: Set<string>): void {
  for (const block of blocks) {
    if (isCustomBlock(block)) {
      out.add(block.customType);
      continue;
    }
    if (block.type === "section") {
      // SectionBlock has `children: Block[][]` (one array per column).
      const children = (block as unknown as { children?: Block[][] }).children;
      if (!children) continue;
      for (const column of children) {
        walk(column, out);
      }
    }
  }
}
