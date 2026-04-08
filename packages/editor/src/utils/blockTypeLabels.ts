import type { Translations } from "../i18n";

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
