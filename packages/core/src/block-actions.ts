import type { Block, BlockType } from "@templatical/types";
import { createBlock, generateId } from "@templatical/types";

export interface UseBlockActionsOptions {
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
  removeBlock: (blockId: string) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  selectBlock: (blockId: string | null) => void;
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
  const { addBlock, removeBlock, updateBlock, selectBlock } = options;

  function createAndAddBlock(
    type: BlockType,
    targetSectionId?: string,
    columnIndex?: number,
  ): Block {
    const block = createBlock(type);
    addBlock(block, targetSectionId, columnIndex);
    selectBlock(block.id);
    return block;
  }

  function duplicateBlock(
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
  ): Block {
    const cloned = JSON.parse(JSON.stringify(block)) as Block;
    cloned.id = generateId();

    if (cloned.type === "section") {
      cloned.children = cloned.children.map((column) =>
        column.map((child) => {
          const clonedChild = JSON.parse(JSON.stringify(child)) as Block;
          clonedChild.id = generateId();
          return clonedChild;
        }),
      );
    }

    addBlock(cloned, targetSectionId, columnIndex);
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
