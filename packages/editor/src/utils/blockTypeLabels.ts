import type { Translations } from "../i18n";
import type {
  Block,
  CustomBlock,
  CustomBlockDefinition,
} from "@templatical/types";

/**
 * Returns the i18n label for a built-in block type.
 * Falls back to the raw type string for unknown types.
 */
export function getBlockTypeLabel(
  blockType: string,
  translations: Translations,
): string {
  const labels = translations.blocks as Record<string, string>;
  return labels[blockType] ?? blockType;
}

/**
 * Display label for a block *instance*, which is what user-facing copy wants:
 * built-ins resolve to their i18n label, custom blocks to the consumer's own
 * name for them ("Featured Article"), not the literal type `"custom"`.
 *
 * `blocks` carries no `custom` key on purpose — one generic "Custom" would make
 * two different custom blocks indistinguishable in a list. The name comes from
 * the definition instead; it is consumer-supplied and therefore NOT localized,
 * which is already how the toolbar and the sidebar palette present it.
 *
 * Falls back to `customType` (the slug) when no definition matches — an
 * instance whose definition was never registered — mirroring `Toolbar.vue`.
 * Pass the array injected under `CUSTOM_BLOCK_DEFINITIONS_KEY`; omitting it
 * degrades to that same slug fallback rather than throwing.
 */
export function getBlockLabel(
  block: Block,
  translations: Translations,
  customBlockDefinitions: readonly CustomBlockDefinition[] = [],
): string {
  if (block.type !== "custom") {
    return getBlockTypeLabel(block.type, translations);
  }
  const { customType } = block as CustomBlock;
  const definition = customBlockDefinitions.find((d) => d.type === customType);
  return definition?.name ?? customType;
}
