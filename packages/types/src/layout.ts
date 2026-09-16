import type { Block, WrapperBlock } from "./blocks";
import { safeClone } from "./clone";
import { cloneBlock } from "./factory";
import { isSection, isSlot, isWrapper } from "./guards";
import type { TemplateContent } from "./template";

const EXACTLY_ONE_SLOT =
  "[Templatical] layout: must contain exactly one slot block";
const SLOT_NESTED_IN_SECTION =
  "[Templatical] layout: slot must be a top-level or wrapper child, not nested in a section";
const WRAPPER_IN_WRAPPER =
  "[Templatical] layout: a wrapper cannot contain a wrapper";
const NESTED_MJ_WRAPPER =
  "[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)";
const SLOT_IN_CONTENT = "[Templatical] slot is not a valid content block";
const WRAPPER_IN_CONTENT = "[Templatical] wrapper is not a valid content block";

function walkBlocks(
  blocks: Block[],
  visit: (block: Block, parent: Block | null) => void,
  parent: Block | null = null,
): void {
  for (const block of blocks) {
    visit(block, parent);
    if (isSection(block)) {
      for (const column of block.children) {
        walkBlocks(column, visit, block);
      }
    } else if (isWrapper(block)) {
      walkBlocks(block.children, visit, block);
    }
  }
}

/** Throw if `layout` does not contain exactly one legal slot. */
export function validateLayout(layout: TemplateContent): void {
  let slotCount = 0;
  walkBlocks(layout.blocks, (block, parent) => {
    if (isSlot(block)) {
      slotCount += 1;
      if (parent !== null && isSection(parent)) {
        throw new Error(SLOT_NESTED_IN_SECTION);
      }
    }
    if (isWrapper(block) && block.children.some(isWrapper)) {
      throw new Error(WRAPPER_IN_WRAPPER);
    }
  });
  if (slotCount !== 1) {
    throw new Error(EXACTLY_ONE_SLOT);
  }
}

export function assertNoSlotInContent(content: TemplateContent): void {
  walkBlocks(content.blocks, (block) => {
    if (isSlot(block)) {
      throw new Error(SLOT_IN_CONTENT);
    }
  });
}

export function assertNoWrapperInContent(content: TemplateContent): void {
  walkBlocks(content.blocks, (block) => {
    if (isWrapper(block)) {
      throw new Error(WRAPPER_IN_CONTENT);
    }
  });
}

/** True iff the one slot is a direct child of a wrapper (the card). */
export function layoutWrapsSlot(layout: TemplateContent): boolean {
  let wrapped = false;
  walkBlocks(layout.blocks, (block, parent) => {
    if (isSlot(block) && parent !== null && isWrapper(parent)) {
      wrapped = true;
    }
  });
  return wrapped;
}

function cloneLayoutBlock(block: Block): Block {
  if (isSlot(block)) return block;
  if (isWrapper(block)) {
    const cloned = cloneBlock({ ...block, children: [] }) as WrapperBlock;
    cloned.children = block.children.map(cloneLayoutBlock);
    return cloned;
  }
  return cloneBlock(block);
}

function findSlotLocation(
  blocks: Block[],
): { parent: Block[]; index: number } | null {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (isSlot(block)) {
      return { parent: blocks, index: i };
    }
    if (isWrapper(block)) {
      const nested = findSlotLocation(block.children);
      if (nested) return nested;
    }
  }
  return null;
}

function emitsMjWrapper(blocks: Block[]): boolean {
  for (const block of blocks) {
    if (isSection(block)) {
      if (block.wrapper) return true;
      for (const column of block.children) {
        if (emitsMjWrapper(column)) return true;
      }
    }
  }
  return false;
}

/**
 * Overlay `layout` around `content`. Clones both; remints layout ids.
 * Layout wins only `settings.backgroundColor`.
 */
export function applyLayout(
  layout: TemplateContent,
  content: TemplateContent,
): TemplateContent {
  validateLayout(layout);
  assertNoSlotInContent(content);
  assertNoWrapperInContent(content);

  if (layoutWrapsSlot(layout) && emitsMjWrapper(content.blocks)) {
    throw new Error(NESTED_MJ_WRAPPER);
  }

  const blocks = layout.blocks.map(cloneLayoutBlock);
  const location = findSlotLocation(blocks);
  if (!location) {
    throw new Error(EXACTLY_ONE_SLOT);
  }
  location.parent.splice(location.index, 1, ...safeClone(content.blocks));

  return {
    blocks,
    settings: {
      ...safeClone(content.settings),
      backgroundColor: layout.settings.backgroundColor,
    },
  };
}
