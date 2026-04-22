import { describe, expect, it, vi } from 'vitest';
import { createParagraphBlock, createTitleBlock, createSectionBlock, type BlockDefaults } from '@templatical/types';
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

        const block = actions.createAndAddBlock('paragraph');
        expect(block.type).toBe('paragraph');
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
        const original = createParagraphBlock({ content: '<p>Test</p>' });

        const cloned = actions.duplicateBlock(original);
        expect(cloned.id).not.toBe(original.id);
        expect(cloned.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(cloned.type).toBe('paragraph');
        expect(opts.addBlock).toHaveBeenCalledWith(cloned, undefined, undefined);
        expect(opts.selectBlock).toHaveBeenCalledWith(cloned.id);
    });

    it('duplicates section with new child IDs', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const child = createParagraphBlock();
        const section = createSectionBlock({ children: [[child]] });

        const cloned = actions.duplicateBlock(section);
        if (cloned.type === 'section') {
            expect(cloned.children[0][0].id).not.toBe(child.id);
            expect(cloned.children[0][0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
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

        actions.updateBlockProperty('block-1', 'type', 'paragraph');
        expect(opts.updateBlock).toHaveBeenCalledWith('block-1', { type: 'paragraph' });
    });

    it('duplicates section with empty columns preserving structure', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const section = createSectionBlock({ children: [[], []] });

        const cloned = actions.duplicateBlock(section);
        expect(cloned.id).not.toBe(section.id);
        expect(cloned.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(cloned.type).toBe('section');
        if (cloned.type === 'section') {
            expect(cloned.children).toHaveLength(2);
            expect(cloned.children[0]).toEqual([]);
            expect(cloned.children[1]).toEqual([]);
        }
        expect(opts.addBlock).toHaveBeenCalledWith(cloned, undefined, undefined);
        expect(opts.selectBlock).toHaveBeenCalledWith(cloned.id);
    });

    it('duplicates section ensuring all child block IDs are unique', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const child1 = createParagraphBlock({ content: '<p>A</p>' });
        const child2 = createParagraphBlock({ content: '<p>B</p>' });
        const child3 = createParagraphBlock({ content: '<p>C</p>' });
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
        const original = createParagraphBlock({ content: '<p>Simple</p>' });

        const cloned = actions.duplicateBlock(original);
        expect(cloned.id).not.toBe(original.id);
        expect(cloned.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(cloned.type).toBe('paragraph');
        if (cloned.type === 'paragraph' && original.type === 'paragraph') {
            expect(cloned.content).toBe(original.content);
        }
        expect(opts.addBlock).toHaveBeenCalledWith(cloned, undefined, undefined);
        expect(opts.selectBlock).toHaveBeenCalledWith(cloned.id);
    });

    it('duplicateBlock does not modify the original block', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);
        const original = createParagraphBlock({ content: '<p>Original</p>' });
        const originalId = original.id;

        actions.duplicateBlock(original);
        expect(original.id).toBe(originalId);
    });
});

describe('useBlockActions with blockDefaults', () => {
    it('creates block with blockDefaults applied', () => {
        const defaults: BlockDefaults = {
            title: { color: '#000000' },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('title');
        expect(block.type).toBe('title');
        if (block.type === 'title') {
            expect(block.color).toBe('#000000');
        }
    });

    it('applies correct defaults per block type', () => {
        const defaults: BlockDefaults = {
            title: { color: '#ff0000' },
            button: { backgroundColor: '#ff0000' },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const titleBlock = actions.createAndAddBlock('title');
        const buttonBlock = actions.createAndAddBlock('button');
        if (titleBlock.type === 'title') {
            expect(titleBlock.color).toBe('#ff0000');
        }
        if (buttonBlock.type === 'button') {
            expect(buttonBlock.backgroundColor).toBe('#ff0000');
            expect(buttonBlock.textColor).toBe('#ffffff');
        }
    });

    it('does not apply blockDefaults for mismatched types', () => {
        const defaults: BlockDefaults = {
            title: { color: '#ff0000' },
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
            title: { color: '#ff0000' },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const original = createTitleBlock({ color: '#00ff00' });
        const cloned = actions.duplicateBlock(original);
        if (cloned.type === 'title') {
            expect(cloned.color).toBe('#00ff00');
        }
    });

    it('works without blockDefaults (backward compatible)', () => {
        const opts = createMockOptions();
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('title');
        if (block.type === 'title') {
            expect(block.color).toBe('#1a1a1a');
        }
    });

    it('applies deep-merged styles via blockDefaults', () => {
        const defaults: BlockDefaults = {
            paragraph: { styles: { padding: { top: 30 } } },
        };
        const opts = { ...createMockOptions(), blockDefaults: defaults };
        const actions = useBlockActions(opts);

        const block = actions.createAndAddBlock('paragraph');
        if (block.type === 'paragraph') {
            expect(block.styles.padding.top).toBe(30);
            expect(block.styles.padding.right).toBe(10);
            expect(block.styles.margin.top).toBe(0);
        }
    });
});
