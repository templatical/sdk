import { canMutate, inheritMutationGuard } from "./mutation-guard";
import { watch, type Ref } from "@vue/reactivity";
import type { Block, TemplateSettings } from "@templatical/types";
import type { UseHistoryReturn } from "./history";

/**
 * The mutable slice of an editor this wraps — structural, so the OSS and Cloud
 * `useEditor` returns both satisfy it without either having to grow toward the
 * other. Not `Readonly`: the whole point is to replace these members in place.
 */
export interface HistoryInterceptorEditor {
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
    index?: number,
  ) => void;
  removeBlock: (blockId: string) => void;
  moveBlock: (
    blockId: string,
    newIndex: number,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  updateSettings: (updates: Partial<TemplateSettings>) => void;
  isBlockLocked: (blockId: string) => boolean;
  activeLocale?: Ref<string | null>;
  addLocale?: (locale: string) => void;
  removeLocale?: (locale: string) => void;
  setBlockHidden?: (blockId: string, hidden: boolean) => void;
  resetLocaleFields?: (blockId: string, paths?: string[]) => void;
  keepTranslations?: (blockId: string, paths: string[]) => void;
}

/**
 * Wraps editor mutation methods to record history snapshots before each
 * operation. Mutates the editor object in place.
 *
 * Not installed with a collaboration provider: its controller captures
 * changes by diffing the content and keeps its own undo history.
 */
export function useHistoryInterceptor(
  editor: HistoryInterceptorEditor,
  history: UseHistoryReturn,
): void {
  if (editor.activeLocale)
    watch(editor.activeLocale, () => history.flushDebounce?.());
  for (const key of [
    "addLocale",
    "removeLocale",
    "setBlockHidden",
    "resetLocaleFields",
    "keepTranslations",
  ] as const) {
    const original = editor[key];
    if (!original) continue;
    Object.assign(editor, {
      [key]: (...args: unknown[]) => {
        if (!canMutate(editor, key, args)) return;
        if (
          !["addLocale", "removeLocale"].includes(key) &&
          editor.isBlockLocked(args[0] as string)
        )
          return;
        history.record();
        (original as (...values: unknown[]) => void)(...args);
      },
    });
    inheritMutationGuard(original, editor[key]!);
  }
  const originalAddBlock = editor.addBlock;
  const originalRemoveBlock = editor.removeBlock;
  const originalMoveBlock = editor.moveBlock;
  const originalUpdateBlock = editor.updateBlock;
  const originalUpdateSettings = editor.updateSettings;

  // Skip recording when the underlying op is a no-op (e.g., a peer-locked
  // block or section), otherwise the undo stack fills with snapshots that
  // are identical to current state and undo silently does nothing.
  editor.addBlock = (block, targetSectionId?, columnIndex?, index?) => {
    if (
      !canMutate(editor, "addBlock", [
        block,
        targetSectionId,
        columnIndex,
        index,
      ])
    )
      return;
    history.record();
    originalAddBlock(block, targetSectionId, columnIndex, index);
  };

  editor.removeBlock = (blockId) => {
    if (!canMutate(editor, "removeBlock", [blockId])) return;
    history.record();
    originalRemoveBlock(blockId);
  };

  editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
    if (
      !canMutate(editor, "moveBlock", [
        blockId,
        newIndex,
        targetSectionId,
        columnIndex,
      ])
    )
      return;
    history.record();
    originalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
  };

  inheritMutationGuard(originalAddBlock, editor.addBlock);
  inheritMutationGuard(originalRemoveBlock, editor.removeBlock);
  inheritMutationGuard(originalMoveBlock, editor.moveBlock);

  editor.updateBlock = (blockId, updates) => {
    if (!canMutate(editor, "updateBlock", [blockId, updates])) return;
    if (editor.isBlockLocked(blockId)) {
      return;
    }
    history.recordDebounced(blockId);
    originalUpdateBlock(blockId, updates);
  };

  editor.updateSettings = (updates) => {
    if (!canMutate(editor, "updateSettings", [updates])) return;
    history.record();
    originalUpdateSettings(updates);
  };
  inheritMutationGuard(originalUpdateBlock, editor.updateBlock);
  inheritMutationGuard(originalUpdateSettings, editor.updateSettings);
}
