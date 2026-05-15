import type { Block, BlockDefaults, BlockType } from "@templatical/types";
import { createBlock, generateId } from "@templatical/types";

function regenerateNestedIds(block: Block): void {
  if (block.type === "table") {
    block.rows = block.rows.map((row) => ({
      ...row,
      id: generateId(),
      cells: row.cells.map((cell) => ({ ...cell, id: generateId() })),
    }));
  } else if (block.type === "social") {
    block.icons = block.icons.map((icon) => ({ ...icon, id: generateId() }));
  } else if (block.type === "menu") {
    block.items = block.items.map((item) => ({ ...item, id: generateId() }));
  }
}

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
  blockDefaults?: BlockDefaults;
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
    const block = createBlock(type, options.blockDefaults);
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
    regenerateNestedIds(cloned);

    if (cloned.type === "section") {
      cloned.children = cloned.children.map((column) =>
        column.map((child) => {
          const clonedChild = JSON.parse(JSON.stringify(child)) as Block;
          clonedChild.id = generateId();
          regenerateNestedIds(clonedChild);
          return clonedChild;
        }),
      );
    }

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
