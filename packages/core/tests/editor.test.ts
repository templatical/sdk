import { describe, expect, it } from 'vitest';
import { createDefaultTemplateContent, createTextBlock, createSectionBlock, createImageBlock } from '@templatical/types';
import { useEditor } from '../src';

function createEditorWithContent() {
    const content = createDefaultTemplateContent();
    content.blocks = [
        createTextBlock({ content: '<p>Hello</p>' }),
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
        expect(editor.selectedBlock.value?.type).toBe('text');

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
        if (block.type === 'text') {
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
        const block = createTextBlock();

        editor.addBlock(block);
        expect(editor.state.content.blocks).toHaveLength(1);
        expect(editor.state.content.blocks[0].id).toBe(block.id);
    });

    it('adds block at specific index', () => {
        const editor = createEditorWithContent();
        const newBlock = createTextBlock({ content: '<p>Inserted</p>' });

        editor.addBlock(newBlock, undefined, undefined, 0);
        expect(editor.state.content.blocks[0].id).toBe(newBlock.id);
    });

    it('adds block inside section column', () => {
        const editor = createEditorWithContent();
        const section = editor.state.content.blocks[1];
        const newBlock = createTextBlock({ content: '<p>In column</p>' });

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
        const block1 = createTextBlock({ content: '<p>First</p>' });
        const block2 = createTextBlock({ content: '<p>Second</p>' });
        content.blocks = [block1, block2];
        const editor = useEditor({ content });

        editor.moveBlock(block2.id, 0);
        expect(editor.state.content.blocks[0].id).toBe(block2.id);
        expect(editor.state.content.blocks[1].id).toBe(block1.id);
    });

    it('sets content directly', () => {
        const editor = createEditorWithContent();
        const newContent = createDefaultTemplateContent();
        newContent.blocks = [createTextBlock({ content: '<p>New</p>' })];

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
