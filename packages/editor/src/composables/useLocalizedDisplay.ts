import { computed } from "vue";
import {
  defaultLocaleOf,
  localeCoverage,
  localizeBlock,
  resolveLocale,
  type Block,
  type CustomBlockDefinition,
} from "@templatical/types";
import type { BaseEditorReturn } from "./useEditorCore";

/** Project display values while leaving the shared tree available to actions. */
export function useLocalizedDisplay(
  editor: Pick<BaseEditorReturn, "content" | "activeLocale">,
) {
  const content = computed(() => {
    const base = editor.content.value;
    const locale = editor.activeLocale?.value;
    return locale ? resolveLocale(base, locale) : base;
  });
  // Settings project on their own, so reading them doesn't project every block.
  const settings = computed(() => {
    const base = editor.content.value;
    const locale = editor.activeLocale?.value;
    return locale
      ? resolveLocale({ blocks: [], settings: base.settings }, locale).settings
      : base.settings;
  });
  function displayBlock(block: Block): Block {
    const locale = editor.activeLocale?.value;
    return locale
      ? localizeBlock(block, locale, defaultLocaleOf(editor.content.value))
      : block;
  }
  return { content, settings, displayBlock };
}

/** The active language view's coverage; `null` in the default view. */
export function useActiveLocaleCoverage(
  editor: Pick<BaseEditorReturn, "content" | "activeLocale">,
  definitions: readonly CustomBlockDefinition[],
) {
  return computed(() => {
    const source = defaultLocaleOf(editor.content.value);
    const active = editor.activeLocale?.value ?? source;
    return active === source
      ? null
      : localeCoverage(editor.content.value, active, definitions);
  });
}
