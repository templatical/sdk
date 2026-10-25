import { computed } from "vue";
import {
  defaultLocaleOf,
  localizeBlock,
  resolveLocale,
  type Block,
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
  const settings = computed(() => content.value.settings);
  function displayBlock(block: Block): Block {
    const locale = editor.activeLocale?.value;
    return locale
      ? localizeBlock(block, locale, defaultLocaleOf(editor.content.value))
      : block;
  }
  return { content, settings, displayBlock };
}
