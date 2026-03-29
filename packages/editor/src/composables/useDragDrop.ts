import type { Block } from "@templatical/types";
import { ref, type Ref } from "vue";

export interface UseDragDropOptions {
  onBlockMove: (
    blockId: string,
    newIndex: number,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
  onBlockAdd: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
}

export interface UseDragDropReturn {
  isDragging: Ref<boolean>;
  draggedBlock: Ref<Block | null>;
  dropTargetId: Ref<string | null>;
  startDrag: (block: Block) => void;
  endDrag: () => void;
  setDropTarget: (targetId: string | null) => void;
  handleDrop: (
    blocks: Block[],
    newIndex: number,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
  getSortableOptions: (
    group: string,
    sectionId?: string,
    columnIndex?: number,
  ) => Record<string, unknown>;
}

export function useDragDrop(options: UseDragDropOptions): UseDragDropReturn {
  const { onBlockMove, onBlockAdd } = options;

  const isDragging = ref(false);
  const draggedBlock = ref<Block | null>(null);
  const dropTargetId = ref<string | null>(null);

  function startDrag(block: Block): void {
    isDragging.value = true;
    draggedBlock.value = block;
  }

  function endDrag(): void {
    isDragging.value = false;
    draggedBlock.value = null;
    dropTargetId.value = null;
  }

  function setDropTarget(targetId: string | null): void {
    dropTargetId.value = targetId;
  }

  function handleDrop(
    blocks: Block[],
    newIndex: number,
    targetSectionId?: string,
    columnIndex?: number,
  ): void {
    if (!draggedBlock.value) return;

    const existingIndex = blocks.findIndex(
      (b) => b.id === draggedBlock.value!.id,
    );

    if (existingIndex === -1) {
      onBlockAdd(draggedBlock.value, targetSectionId, columnIndex);
    } else {
      onBlockMove(
        draggedBlock.value.id,
        newIndex,
        targetSectionId,
        columnIndex,
      );
    }

    endDrag();
  }

  function getSortableOptions(
    group: string,
    sectionId?: string,
    columnIndex?: number,
  ): Record<string, unknown> {
    return {
      group,
      animation: 150,
      ghostClass: "tpl-ghost",
      dragClass: "tpl-drag",
      handle: ".tpl-drag-handle",
      onStart: (evt: { item: { dataset: { blockId?: string } } }) => {
        const blockId = evt.item.dataset.blockId;
        if (blockId) {
          isDragging.value = true;
        }
      },
      onEnd: () => {
        endDrag();
      },
      onAdd: (evt: {
        item: { dataset: { blockId?: string } };
        newIndex: number;
      }) => {
        const blockId = evt.item.dataset.blockId;
        if (blockId) {
          onBlockMove(blockId, evt.newIndex, sectionId, columnIndex);
        }
      },
      onUpdate: (evt: {
        item: { dataset: { blockId?: string } };
        newIndex: number;
      }) => {
        const blockId = evt.item.dataset.blockId;
        if (blockId) {
          onBlockMove(blockId, evt.newIndex, sectionId, columnIndex);
        }
      },
    };
  }

  return {
    isDragging,
    draggedBlock,
    dropTargetId,
    startDrag,
    endDrag,
    setDropTarget,
    handleDrop,
    getSortableOptions,
  };
}
