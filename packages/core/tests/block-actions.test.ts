import { describe, expect, it, vi } from 'vitest';
import { createTextBlock, createSectionBlock } from '@templatical/types';
import { useBlockActions } from '../src';

function createMockOptions() {
    return {
        addBlock: vi.fn(),
        removeBlock: vi.fn(),
        updateBlock: vi.fn(),
        selectBlock: vi.fn(),
    };
}

describe('useBlockActions', () => {
    it('creates and adds a block by type', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('text');
        expect(block.type).toBe('text');
        expect(opts.addBlock).toHaveBeenCalledWith(block, undefined, undefined);
        expect(opts.selectBlock).toHaveBeenCalledWith(block.id);
    });

    it('creates block in a specific section column', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);

        actions.createAndAddBlock('image', 'section-1', 1);
        expect(opts.addBlock).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'image' }),
            'section-1',
            1,
        );
    });

    it('duplicates a block with new ID', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const original = createTextBlock({ content: '<p>Test</p>' });

        const cloned = actions.duplicateBlock(original);
        expect(cloned.id).not.toBe(original.id);
        expect(cloned.type).toBe('text');
        expect(opts.addBlock).toHaveBeenCalled();
        expect(opts.selectBlock).toHaveBeenCalledWith(cloned.id);
    });

    it('duplicates section with new child IDs', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const child = createTextBlock();
        const section = createSectionBlock({ children: [[child]] });

        const cloned = actions.duplicateBlock(section);
        if (cloned.type === 'section') {
            expect(cloned.children[0][0].id).not.toBe(child.id);
        }
    });

    it('deletes a block', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);

        actions.deleteBlock('block-1');
        expect(opts.removeBlock).toHaveBeenCalledWith('block-1');
    });

    it('updates a single block property', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);

        actions.updateBlockProperty('block-1', 'type', 'text');
        expect(opts.updateBlock).toHaveBeenCalledWith('block-1', { type: 'text' });
    });
});
