import { describe, expect, it, vi } from 'vitest';
import { createTextBlock, createSectionBlock, type BlockDefaults } from '@templatical/types';
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

    it('duplicates section with empty columns preserving structure', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const section = createSectionBlock({ children: [[], []] });

        const cloned = actions.duplicateBlock(section);
        expect(cloned.id).not.toBe(section.id);
        expect(cloned.type).toBe('section');
        if (cloned.type === 'section') {
            expect(cloned.children).toHaveLength(2);
            expect(cloned.children[0]).toEqual([]);
            expect(cloned.children[1]).toEqual([]);
        }
        expect(opts.addBlock).toHaveBeenCalled();
        expect(opts.selectBlock).toHaveBeenCalledWith(cloned.id);
    });

    it('duplicates section ensuring all child block IDs are unique', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const child1 = createTextBlock({ content: '<p>A</p>' });
        const child2 = createTextBlock({ content: '<p>B</p>' });
        const child3 = createTextBlock({ content: '<p>C</p>' });
        const section = createSectionBlock({ children: [[child1, child2], [child3]] });

        const cloned = actions.duplicateBlock(section);
        expect(cloned.type).toBe('section');
        if (cloned.type === 'section' && section.type === 'section') {
            // Collect all original IDs
            const originalIds = new Set([
                section.id,
                child1.id,
                child2.id,
                child3.id,
            ]);
            // Collect all cloned IDs
            const clonedIds = [cloned.id];
            for (const col of cloned.children) {
                for (const block of col) {
                    clonedIds.push(block.id);
                }
            }
            // No cloned ID should match any original ID
            for (const id of clonedIds) {
                expect(originalIds.has(id)).toBe(false);
            }
            // All cloned IDs should be unique among themselves
            expect(new Set(clonedIds).size).toBe(clonedIds.length);
        }
    });

    it('duplicates a non-section block (simple block) with new ID', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const original = createTextBlock({ content: '<p>Simple</p>' });

        const cloned = actions.duplicateBlock(original);
        expect(cloned.id).not.toBe(original.id);
        expect(cloned.type).toBe('text');
        if (cloned.type === 'text' && original.type === 'text') {
            expect(cloned.content).toBe(original.content);
        }
        expect(opts.addBlock).toHaveBeenCalledWith(cloned, undefined, undefined);
        expect(opts.selectBlock).toHaveBeenCalledWith(cloned.id);
    });

    it('duplicateBlock does not modify the original block', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const original = createTextBlock({ content: '<p>Original</p>' });
        const originalId = original.id;

        actions.duplicateBlock(original);
        expect(original.id).toBe(originalId);
    });
});

describe('useBlockActions with blockDefaults', () => {
    it('creates block with blockDefaults applied', () => {
        const defaults: BlockDefaults = {
            text: { fontSize: 24, color: '#000000' },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('text');
        expect(block.type).toBe('text');
        if (block.type === 'text') {
            expect(block.fontSize).toBe(24);
            expect(block.color).toBe('#000000');
        }
    });

    it('applies correct defaults per block type', () => {
        const defaults: BlockDefaults = {
            text: { fontSize: 24 },
            button: { backgroundColor: '#ff0000' },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const textBlock = actions.createAndAddBlock('text');
        const buttonBlock = actions.createAndAddBlock('button');
        if (textBlock.type === 'text') {
            expect(textBlock.fontSize).toBe(24);
        }
        if (buttonBlock.type === 'button') {
            expect(buttonBlock.backgroundColor).toBe('#ff0000');
            expect(buttonBlock.textColor).toBe('#ffffff');
        }
    });

    it('does not apply blockDefaults for mismatched types', () => {
        const defaults: BlockDefaults = {
            text: { fontSize: 24 },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('button');
        if (block.type === 'button') {
            expect(block.fontSize).toBe(15);
        }
    });

    it('duplicateBlock ignores blockDefaults', () => {
        const defaults: BlockDefaults = {
            text: { fontSize: 24 },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const original = createTextBlock({ fontSize: 12 });
        const cloned = actions.duplicateBlock(original);
        if (cloned.type === 'text') {
            expect(cloned.fontSize).toBe(12);
        }
    });

    it('works without blockDefaults (backward compatible)', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('text');
        if (block.type === 'text') {
            expect(block.fontSize).toBe(16);
        }
    });

    it('applies deep-merged styles via blockDefaults', () => {
        const defaults: BlockDefaults = {
            text: { styles: { padding: { top: 30 } } },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('text');
        if (block.type === 'text') {
            expect(block.styles.padding.top).toBe(30);
            expect(block.styles.padding.right).toBe(10);
            expect(block.styles.margin.top).toBe(0);
        }
    });
});
