import { describe, expect, it } from 'vitest';
import { ref } from '@vue/reactivity';
import { createDefaultTemplateContent, createParagraphBlock, createSectionBlock, createImageBlock } from '@templatical/types';
import { useEditor } from '../src';

function createEditorWithContent() {
    const content = createDefaultTemplateContent();
    content.blocks = [
        createParagraphBlock({ content: '<p>Hello</p>' }),
        createSectionBlock({
            children: [[createImageBlock({ src: 'test.png' })]],
        }),
    ];
    return useEditor({ content });
}

describe('useEditor', () => {
    it('initializes with provided content', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        expect(editor.state.content.settings.width).toBe(600);
        expect(editor.state.content.blocks).toEqual([]);
    });

    it('tracks dirty state', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        expect(editor.state.isDirty).toBe(false);
        editor.markDirty();
        expect(editor.state.isDirty).toBe(true);
    });

    it('selects and deselects blocks', () => {
        const editor = createEditorWithContent();
        const blockId = editor.state.content.blocks[0].id;

        editor.selectBlock(blockId);
        expect(editor.state.selectedBlockId).toBe(blockId);
        expect(editor.selectedBlock.value?.type).toBe('paragraph');

        editor.selectBlock(null);
        expect(editor.state.selectedBlockId).toBeNull();
        expect(editor.selectedBlock.value).toBeNull();
    });

    it('updates viewport', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        editor.setViewport('mobile');
        expect(editor.state.viewport).toBe('mobile');
    });

    it('toggles dark mode', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        editor.setDarkMode(true);
        expect(editor.state.darkMode).toBe(true);
    });

    it('defaults uiTheme to auto', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        expect(editor.state.uiTheme).toBe('auto');
    });

    it('sets uiTheme to light', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        editor.setUiTheme('light');
        expect(editor.state.uiTheme).toBe('light');
    });

    it('sets uiTheme to dark', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        editor.setUiTheme('dark');
        expect(editor.state.uiTheme).toBe('dark');
    });

    it('uiTheme is independent from darkMode', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        editor.setUiTheme('dark');
        editor.setDarkMode(false);
        expect(editor.state.uiTheme).toBe('dark');
        expect(editor.state.darkMode).toBe(false);
    });

    it('toggles preview mode and clears selection', () => {
        const editor = createEditorWithContent();
        const blockId = editor.state.content.blocks[0].id;
        editor.selectBlock(blockId);

        editor.setPreviewMode(true);
        expect(editor.state.previewMode).toBe(true);
        expect(editor.state.selectedBlockId).toBeNull();
    });

    it('updates block properties', () => {
        const editor = createEditorWithContent();
        const blockId = editor.state.content.blocks[0].id;

        editor.updateBlock(blockId, { content: '<p>Updated</p>' } as Partial<any>);
        const block = editor.state.content.blocks[0];
        if (block.type === 'paragraph') {
            expect(block.content).toBe('<p>Updated</p>');
        }
        expect(editor.state.isDirty).toBe(true);
    });

    it('updates template settings', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });

        editor.updateSettings({ width: 700, backgroundColor: '#f0f0f0' });
        expect(editor.state.content.settings.width).toBe(700);
        expect(editor.state.content.settings.backgroundColor).toBe('#f0f0f0');
    });

    it('adds block at root level', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        const block = createParagraphBlock();

        editor.addBlock(block);
        expect(editor.state.content.blocks).toHaveLength(1);
        expect(editor.state.content.blocks[0].id).toBe(block.id);
    });

    it('adds block at specific index', () => {
        const editor = createEditorWithContent();
        const newBlock = createParagraphBlock({ content: '<p>Inserted</p>' });

        editor.addBlock(newBlock, undefined, undefined, 0);
        expect(editor.state.content.blocks[0].id).toBe(newBlock.id);
    });

    it('adds block inside section column', () => {
        const editor = createEditorWithContent();
        const section = editor.state.content.blocks[1];
        const newBlock = createParagraphBlock({ content: '<p>In column</p>' });

        editor.addBlock(newBlock, section.id, 0);
        if (section.type === 'section') {
            expect(section.children[0]).toHaveLength(2);
        }
    });

    it('removes block and clears selection', () => {
        const editor = createEditorWithContent();
        const blockId = editor.state.content.blocks[0].id;
        editor.selectBlock(blockId);

        editor.removeBlock(blockId);
        expect(editor.state.content.blocks).toHaveLength(1);
        expect(editor.state.selectedBlockId).toBeNull();
    });

    it('moves block to new position', () => {
        const content = createDefaultTemplateContent();
        const block1 = createParagraphBlock({ content: '<p>First</p>' });
        const block2 = createParagraphBlock({ content: '<p>Second</p>' });
        content.blocks = [block1, block2];
        const editor = useEditor({ content });

        editor.moveBlock(block2.id, 0);
        expect(editor.state.content.blocks[0].id).toBe(block2.id);
        expect(editor.state.content.blocks[1].id).toBe(block1.id);
    });

    it('sets content directly', () => {
        const editor = createEditorWithContent();
        const newContent = createDefaultTemplateContent();
        newContent.blocks = [createParagraphBlock({ content: '<p>New</p>' })];

        editor.setContent(newContent);
        expect(editor.state.content.blocks).toHaveLength(1);
        expect(editor.state.isDirty).toBe(true);
    });

    it('sets content without marking dirty', () => {
        const editor = createEditorWithContent();
        const newContent = createDefaultTemplateContent();

        editor.setContent(newContent, false);
        expect(editor.state.isDirty).toBe(false);
    });
});

describe('locked blocks', () => {
    function createEditorWithLockedBlocks() {
        const content = createDefaultTemplateContent();
        content.blocks = [
            createParagraphBlock({ content: '<p>Locked</p>' }),
            createParagraphBlock({ content: '<p>Unlocked</p>' }),
        ];
        const lockedBlockId = content.blocks[0].id;
        const lockedBlocks = ref(new Map([[lockedBlockId, { id: 'other-user' }]]));
        const editor = useEditor({ content, lockedBlocks });
        return { editor, lockedBlockId, unlockedBlockId: content.blocks[1].id };
    }

    it('selectBlock does nothing when block is locked', () => {
        const { editor, lockedBlockId } = createEditorWithLockedBlocks();
        editor.selectBlock(lockedBlockId);
        expect(editor.state.selectedBlockId).toBeNull();
    });

    it('updateBlock does nothing when block is locked', () => {
        const { editor, lockedBlockId } = createEditorWithLockedBlocks();
        editor.updateBlock(lockedBlockId, { content: '<p>Changed</p>' } as any);
        const block = editor.state.content.blocks[0];
        expect((block as any).content).toBe('<p>Locked</p>');
    });

    it('removeBlock does nothing when block is locked', () => {
        const { editor, lockedBlockId } = createEditorWithLockedBlocks();
        editor.removeBlock(lockedBlockId);
        expect(editor.state.content.blocks).toHaveLength(2);
    });

    it('isBlockLocked returns true for locked blocks', () => {
        const { editor, lockedBlockId } = createEditorWithLockedBlocks();
        expect(editor.isBlockLocked(lockedBlockId)).toBe(true);
    });

    it('isBlockLocked returns false for unlocked blocks', () => {
        const { editor, unlockedBlockId } = createEditorWithLockedBlocks();
        expect(editor.isBlockLocked(unlockedBlockId)).toBe(false);
    });

    it('isBlockLocked returns false when no lockedBlocks provided', () => {
        const content = createDefaultTemplateContent();
        content.blocks = [createParagraphBlock()];
        const editor = useEditor({ content });
        expect(editor.isBlockLocked(content.blocks[0].id)).toBe(false);
    });
});

describe('edge cases', () => {
    it('addBlock to non-existent section does nothing', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        const block = createParagraphBlock();
        editor.addBlock(block, 'nonexistent-section', 0);
        expect(editor.state.content.blocks).toHaveLength(0);
    });

    it('removeBlock with non-existent ID does nothing', () => {
        const editor = createEditorWithContent();
        const originalLength = editor.state.content.blocks.length;
        editor.removeBlock('nonexistent-id');
        expect(editor.state.content.blocks).toHaveLength(originalLength);
    });

    it('updateBlock with non-existent ID does nothing', () => {
        const editor = createEditorWithContent();
        editor.updateBlock('nonexistent-id', { content: 'x' } as any);
        // Should not throw, just silently skip
        expect(editor.state.isDirty).toBe(false);
    });

    it('moveBlock with non-existent ID does nothing', () => {
        const editor = createEditorWithContent();
        editor.moveBlock('nonexistent-id', 0);
        expect(editor.state.content.blocks).toHaveLength(2);
    });

    it('selectedBlock returns null for non-existent selectedBlockId', () => {
        const content = createDefaultTemplateContent();
        const editor = useEditor({ content });
        // Force a bad ID through internal state
        (editor.state as any).selectedBlockId = 'nonexistent';
        expect(editor.selectedBlock.value).toBeNull();
    });

    it('findBlockById finds blocks inside section columns', () => {
        const editor = createEditorWithContent();
        const section = editor.state.content.blocks[1];
        if (section.type === 'section') {
            const imageBlock = section.children[0][0];
            editor.selectBlock(imageBlock.id);
            expect(editor.selectedBlock.value?.type).toBe('image');
        }
    });

    it('updateBlock with empty updates object still marks dirty', () => {
        const editor = createEditorWithContent();
        const blockId = editor.state.content.blocks[0].id;
        expect(editor.state.isDirty).toBe(false);

        editor.updateBlock(blockId, {});
        expect(editor.state.isDirty).toBe(true);
    });

    it('addBlock with index equal to array length appends', () => {
        const editor = createEditorWithContent();
        const originalLength = editor.state.content.blocks.length;
        const newBlock = createParagraphBlock({ content: '<p>Appended</p>' });

        editor.addBlock(newBlock, undefined, undefined, originalLength);
        expect(editor.state.content.blocks).toHaveLength(originalLength + 1);
        expect(editor.state.content.blocks[originalLength].id).toBe(newBlock.id);
    });

    it('moveBlock to same position keeps block order', () => {
        const content = createDefaultTemplateContent();
        const block1 = createParagraphBlock({ content: '<p>First</p>' });
        const block2 = createParagraphBlock({ content: '<p>Second</p>' });
        content.blocks = [block1, block2];
        const editor = useEditor({ content });

        editor.moveBlock(block1.id, 0);
        expect(editor.state.content.blocks[0].id).toBe(block1.id);
        expect(editor.state.content.blocks[1].id).toBe(block2.id);
    });

    it('moveBlock to non-existent section removes block from source but does not insert', () => {
        const content = createDefaultTemplateContent();
        const block1 = createParagraphBlock({ content: '<p>First</p>' });
        const block2 = createParagraphBlock({ content: '<p>Second</p>' });
        content.blocks = [block1, block2];
        const editor = useEditor({ content });

        editor.moveBlock(block1.id, 0, 'nonexistent-section');
        // Block is removed from source but target section not found, so it's lost
        expect(editor.state.content.blocks.every(b => b.id !== block1.id)).toBe(true);
    });

    it('setContent with markDirty=false does not set isDirty', () => {
        const editor = createEditorWithContent();
        expect(editor.state.isDirty).toBe(false);
        const newContent = createDefaultTemplateContent();

        editor.setContent(newContent, false);
        expect(editor.state.isDirty).toBe(false);
    });

    it('setContent with markDirty=undefined defaults to marking dirty', () => {
        const editor = createEditorWithContent();
        expect(editor.state.isDirty).toBe(false);
        const newContent = createDefaultTemplateContent();

        editor.setContent(newContent);
        expect(editor.state.isDirty).toBe(true);
    });

    it('removeBlock on non-existent blockId does not crash or change state', () => {
        const editor = createEditorWithContent();
        const originalLength = editor.state.content.blocks.length;
        const originalDirty = editor.state.isDirty;

        editor.removeBlock('completely-fake-id');
        expect(editor.state.content.blocks).toHaveLength(originalLength);
        expect(editor.state.isDirty).toBe(originalDirty);
    });

    it('selectBlock with null clears selection', () => {
        const editor = createEditorWithContent();
        const blockId = editor.state.content.blocks[0].id;
        editor.selectBlock(blockId);
        expect(editor.state.selectedBlockId).toBe(blockId);

        editor.selectBlock(null);
        expect(editor.state.selectedBlockId).toBeNull();
    });
});

describe('useEditor with templateDefaults', () => {
    it('applies templateDefaults when no content is provided', () => {
        const editor = useEditor({
            content: undefined as any,
            templateDefaults: {
                width: 640,
                backgroundColor: '#f5f5f5',
            },
        });
        expect(editor.state.content.settings.width).toBe(640);
        expect(editor.state.content.settings.backgroundColor).toBe('#f5f5f5');
        expect(editor.state.content.settings.fontFamily).toBe('Arial, sans-serif');
    });

    it('applies templateDefaults with custom fontFamily', () => {
        const editor = useEditor({
            content: undefined as any,
            defaultFontFamily: 'Helvetica, sans-serif',
            templateDefaults: {
                width: 700,
            },
        });
        expect(editor.state.content.settings.width).toBe(700);
        expect(editor.state.content.settings.fontFamily).toBe('Helvetica, sans-serif');
    });

    it('templateDefaults fontFamily overrides defaultFontFamily', () => {
        const editor = useEditor({
            content: undefined as any,
            defaultFontFamily: 'Helvetica, sans-serif',
            templateDefaults: {
                fontFamily: 'Georgia, serif',
            },
        });
        expect(editor.state.content.settings.fontFamily).toBe('Georgia, serif');
    });

    it('content wins over templateDefaults when content is provided', () => {
        const content = createDefaultTemplateContent();
        content.settings.width = 800;
        content.settings.backgroundColor = '#000000';
        const editor = useEditor({
            content,
            templateDefaults: {
                width: 640,
                backgroundColor: '#f5f5f5',
            },
        });
        expect(editor.state.content.settings.width).toBe(800);
        expect(editor.state.content.settings.backgroundColor).toBe('#000000');
    });

    it('works without templateDefaults (backward compatible)', () => {
        const editor = useEditor({
            content: undefined as any,
        });
        expect(editor.state.content.settings.width).toBe(600);
        expect(editor.state.content.settings.backgroundColor).toBe('#ffffff');
        expect(editor.state.content.settings.fontFamily).toBe('Arial, sans-serif');
    });

    it('applies preheaderText from templateDefaults', () => {
        const editor = useEditor({
            content: undefined as any,
            templateDefaults: {
                preheaderText: 'Check out our latest deals!',
            },
        });
        expect(editor.state.content.settings.preheaderText).toBe('Check out our latest deals!');
    });
});
