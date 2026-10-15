import type { Block, BlockDefaults, BlockType } from "@templatical/types";
import { cloneBlock, createBlock } from "@templatical/types";

export interface UseBlockActionsOptions {
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
    index?: number,
  ) => void;
  removeBlock: (blockId: string) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  selectBlock: (blockId: string | null) => void;
  /** Locate a block in the tree — used by `duplicateBlock` to insert the
   *  clone right after the source instead of appending to the end. */
  findBlockLocation?: (blockId: string) => {
    targetSectionId?: string;
    columnIndex?: number;
    index: number;
  } | null;
  /**
   * Defaults merged onto every block `createAndAddBlock` creates.
   *
   * A **getter** is re-read on each insert; a plain object is captured once.
   * The editor passes a getter because half of these defaults track the
   * template's own `settings.locale`, which the author can change mid-session
   * — a snapshot would pin every later insert to the value at mount.
   */
  blockDefaults?: BlockDefaults | (() => BlockDefaults);
}

export interface UseBlockActionsReturn {
  createAndAddBlock: (
    type: BlockType,
    targetSectionId?: string,
    columnIndex?: number,
  ) => Block;
  duplicateBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
  ) => Block;
  deleteBlock: (blockId: string) => void;
  updateBlockProperty: <K extends keyof Block>(
    blockId: string,
    key: K,
    value: Block[K],
  ) => void;
}

export function useBlockActions(
  options: UseBlockActionsOptions,
): UseBlockActionsReturn {
  const { addBlock, removeBlock, updateBlock, selectBlock, findBlockLocation } =
    options;

  function createAndAddBlock(
    type: BlockType,
    targetSectionId?: string,
    columnIndex?: number,
  ): Block {
    const defaults =
      typeof options.blockDefaults === "function"
        ? options.blockDefaults()
        : options.blockDefaults;
    const block = createBlock(type, defaults);
    addBlock(block, targetSectionId, columnIndex);
    selectBlock(block.id);
    return block;
  }

  function duplicateBlock(
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
  ): Block {
    const cloned = cloneBlock(block);

    // Insert directly after the source block. Explicit target args win;
    // otherwise, resolve the source's location and bump index by 1. Falls
    // back to appending at the end if location is unknown.
    if (targetSectionId !== undefined || columnIndex !== undefined) {
      addBlock(cloned, targetSectionId, columnIndex);
    } else {
      const sourceLocation = findBlockLocation?.(block.id) ?? null;
      if (sourceLocation) {
        addBlock(
          cloned,
          sourceLocation.targetSectionId,
          sourceLocation.columnIndex,
          sourceLocation.index + 1,
        );
      } else {
        addBlock(cloned, targetSectionId, columnIndex);
      }
    }
    selectBlock(cloned.id);
    return cloned;
  }

  function deleteBlock(blockId: string): void {
    removeBlock(blockId);
  }

  function updateBlockProperty<K extends keyof Block>(
    blockId: string,
    key: K,
    value: Block[K],
  ): void {
    updateBlock(blockId, { [key]: value } as Partial<Block>);
  }

  return {
    createAndAddBlock,
    duplicateBlock,
    deleteBlock,
    updateBlockProperty,
  };
}
