import { ref, type Ref } from "vue";
import type { Block, SectionBlock } from "@templatical/types";
import type { BaseEditorReturn } from "./useEditorCore";
import type { UseI18nReturn } from "./useI18n";
import { getBlockTypeLabel } from "../utils/blockTypeLabels";

interface BlockLocation {
  index: number;
  total: number;
  sectionId?: string;
  columnIndex?: number;
}

export interface UseKeyboardReorderReturn {
  liftedBlockId: Ref<string | null>;
  announcement: Ref<string>;
  isLifted: (blockId: string) => boolean;
  lift: (blockId: string) => void;
  cancel: () => void;
  moveUp: (blockId: string) => void;
  moveDown: (blockId: string) => void;
  drop: (blockId: string) => void;
}

/**
 * Keyboard-driven reorder for blocks — mirrors the GitHub Projects pattern.
 * Space/Enter lifts, arrow keys move, Space/Enter drops, Escape cancels.
 * Moves within the same container (top-level or a section column).
 */
export function useKeyboardReorder(
  editor: BaseEditorReturn,
  i18n: UseI18nReturn,
): UseKeyboardReorderReturn {
  const liftedBlockId = ref<string | null>(null);
  const announcement = ref("");
  let originalLocation: BlockLocation | null = null;

  function findBlockLocation(blockId: string): BlockLocation | null {
    const topLevel = editor.content.value.blocks;
    const topIndex = topLevel.findIndex((b) => b.id === blockId);
    if (topIndex !== -1) {
      return { index: topIndex, total: topLevel.length };
    }
    for (const block of topLevel) {
      if (block.type !== "section") continue;
      const section = block as SectionBlock;
      for (let col = 0; col < section.children.length; col++) {
        const column = section.children[col];
        const childIndex = column.findIndex((b: Block) => b.id === blockId);
        if (childIndex !== -1) {
          return {
            index: childIndex,
            total: column.length,
            sectionId: section.id,
            columnIndex: col,
          };
        }
      }
    }
    return null;
  }

  function blockLabel(blockId: string): string {
    const location = findBlockLocation(blockId);
    if (!location) return "";
    const blocks = location.sectionId
      ? resolveColumnBlocks(location.sectionId, location.columnIndex ?? 0)
      : editor.content.value.blocks;
    const block = blocks?.[location.index];
    if (!block) return "";
    return getBlockTypeLabel(block.type, i18n.t);
  }

  function resolveColumnBlocks(
    sectionId: string,
    columnIndex: number,
  ): Block[] | null {
    const section = editor.content.value.blocks.find(
      (b) => b.id === sectionId && b.type === "section",
    ) as SectionBlock | undefined;
    return section?.children[columnIndex] ?? null;
  }

  function announce(message: string): void {
    // Reset to empty first so repeated identical announcements still fire.
    announcement.value = "";
    queueMicrotask(() => {
      announcement.value = message;
    });
  }

  function isLifted(blockId: string): boolean {
    return liftedBlockId.value === blockId;
  }

  function lift(blockId: string): void {
    const location = findBlockLocation(blockId);
    if (!location) return;
    liftedBlockId.value = blockId;
    originalLocation = location;
    announce(
      i18n.format(i18n.t.blockActions.lifted, {
        block: blockLabel(blockId),
        position: String(location.index + 1),
        total: String(location.total),
      }),
    );
  }

  function move(blockId: string, delta: number): void {
    const location = findBlockLocation(blockId);
    if (!location) return;
    const target = location.index + delta;
    if (target < 0 || target >= location.total) return;
    editor.moveBlock(blockId, target, location.sectionId, location.columnIndex);
    announce(
      i18n.format(i18n.t.blockActions.moved, {
        block: blockLabel(blockId),
        position: String(target + 1),
        total: String(location.total),
      }),
    );
  }

  function moveUp(blockId: string): void {
    move(blockId, -1);
  }

  function moveDown(blockId: string): void {
    move(blockId, 1);
  }

  function drop(blockId: string): void {
    const location = findBlockLocation(blockId);
    if (location) {
      announce(
        i18n.format(i18n.t.blockActions.dropped, {
          block: blockLabel(blockId),
          position: String(location.index + 1),
          total: String(location.total),
        }),
      );
    }
    liftedBlockId.value = null;
    originalLocation = null;
  }

  function cancel(): void {
    const id = liftedBlockId.value;
    if (id && originalLocation) {
      const current = findBlockLocation(id);
      const movedAcrossContainers =
        !!current &&
        (current.sectionId !== originalLocation.sectionId ||
          current.columnIndex !== originalLocation.columnIndex);
      const movedWithinContainer =
        !!current && current.index !== originalLocation.index;
      if (current && (movedAcrossContainers || movedWithinContainer)) {
        editor.moveBlock(
          id,
          originalLocation.index,
          originalLocation.sectionId,
          originalLocation.columnIndex,
        );
      }
      announce(
        i18n.format(i18n.t.blockActions.cancelled, {
          block: blockLabel(id),
          position: String(originalLocation.index + 1),
        }),
      );
    }
    liftedBlockId.value = null;
    originalLocation = null;
  }

  return {
    liftedBlockId,
    announcement,
    isLifted,
    lift,
    cancel,
    moveUp,
    moveDown,
    drop,
  };
}
