import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@templatical/types';
import { useDragDrop } from '../src/composables/useDragDrop';

function createMockBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    type: 'text',
    content: 'Hello',
    fontSize: 14,
    color: '#000000',
    textAlign: 'left',
    fontWeight: 'normal',
    styles: {
      backgroundColor: '',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    ...overrides,
  } as Block;
}

describe('useDragDrop', () => {
  function setup(overrides = {}) {
    const onBlockMove = vi.fn();
    const onBlockAdd = vi.fn();
    const result = useDragDrop({ onBlockMove, onBlockAdd, ...overrides });
    return { ...result, onBlockMove, onBlockAdd };
  }

  describe('initial state', () => {
    it('starts with isDragging false', () => {
      const { isDragging } = setup();
      expect(isDragging.value).toBe(false);
    });

    it('starts with draggedBlock null', () => {
      const { draggedBlock } = setup();
      expect(draggedBlock.value).toBeNull();
    });

    it('starts with dropTargetId null', () => {
      const { dropTargetId } = setup();
      expect(dropTargetId.value).toBeNull();
    });
  });

  describe('startDrag', () => {
    it('sets isDragging to true and stores block', () => {
      const { isDragging, draggedBlock, startDrag } = setup();
      const block = createMockBlock();

      startDrag(block);

      expect(isDragging.value).toBe(true);
      expect(draggedBlock.value).toStrictEqual(block);
    });
  });

  describe('endDrag', () => {
    it('resets all state', () => {
      const { isDragging, draggedBlock, dropTargetId, startDrag, endDrag, setDropTarget } = setup();
      const block = createMockBlock();

      startDrag(block);
      setDropTarget('target-1');
      endDrag();

      expect(isDragging.value).toBe(false);
      expect(draggedBlock.value).toBeNull();
      expect(dropTargetId.value).toBeNull();
    });
  });

  describe('setDropTarget', () => {
    it('updates dropTargetId', () => {
      const { dropTargetId, setDropTarget } = setup();

      setDropTarget('section-1');
      expect(dropTargetId.value).toBe('section-1');

      setDropTarget(null);
      expect(dropTargetId.value).toBeNull();
    });
  });

  describe('handleDrop', () => {
    it('calls onBlockAdd when block is not in the blocks array', () => {
      const { startDrag, handleDrop, onBlockAdd, onBlockMove } = setup();
      const block = createMockBlock({ id: 'new-block' });
      const existingBlocks = [createMockBlock({ id: 'existing-1' })];

      startDrag(block);
      handleDrop(existingBlocks, 1, 'section-1', 0);

      expect(onBlockAdd).toHaveBeenCalledWith(block, 'section-1', 0);
      expect(onBlockMove).not.toHaveBeenCalled();
    });

    it('calls onBlockMove when block is in the blocks array', () => {
      const { startDrag, handleDrop, onBlockMove, onBlockAdd } = setup();
      const block = createMockBlock({ id: 'existing-1' });
      const existingBlocks = [block];

      startDrag(block);
      handleDrop(existingBlocks, 2, 'section-1', 0);

      expect(onBlockMove).toHaveBeenCalledWith('existing-1', 2, 'section-1', 0);
      expect(onBlockAdd).not.toHaveBeenCalled();
    });

    it('does nothing when draggedBlock is null', () => {
      const { handleDrop, onBlockMove, onBlockAdd } = setup();

      handleDrop([], 0);

      expect(onBlockMove).not.toHaveBeenCalled();
      expect(onBlockAdd).not.toHaveBeenCalled();
    });

    it('calls endDrag after handling', () => {
      const { startDrag, handleDrop, isDragging, draggedBlock, dropTargetId } = setup();
      const block = createMockBlock();

      startDrag(block);
      handleDrop([], 0);

      expect(isDragging.value).toBe(false);
      expect(draggedBlock.value).toBeNull();
      expect(dropTargetId.value).toBeNull();
    });
  });

  describe('getSortableOptions', () => {
    it('returns object with expected properties', () => {
      const { getSortableOptions } = setup();
      const options = getSortableOptions('blocks');

      expect(options.group).toBe('blocks');
      expect(options.animation).toBe(150);
      expect(options.ghostClass).toBe('tpl-ghost');
      expect(options.dragClass).toBe('tpl-drag');
      expect(options.handle).toBe('.tpl-drag-handle');
      expect(options.onStart).toBeTypeOf('function');
      expect(options.onEnd).toBeTypeOf('function');
      expect(options.onAdd).toBeTypeOf('function');
      expect(options.onUpdate).toBeTypeOf('function');
    });
  });
});
