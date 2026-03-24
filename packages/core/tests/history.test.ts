import { describe, expect, it } from 'vitest';
import { ref } from '@vue/reactivity';
import { createDefaultTemplateContent, createTextBlock } from '@templatical/types';
import { useHistory } from '../src';

function createHistoryWithContent() {
    const content = ref(createDefaultTemplateContent());
    const setContent = (c: any, _markDirty?: boolean) => {
        content.value = c;
    };
    const history = useHistory({ content, setContent });
    return { content, history, setContent };
}

describe('useHistory', () => {
    it('starts with empty stacks', () => {
        const { history } = createHistoryWithContent();
        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(false);
    });

    it('records snapshots for undo', () => {
        const { content, history } = createHistoryWithContent();
        history.record();
        content.value = {
            ...content.value,
            blocks: [createTextBlock()],
        };
        expect(history.canUndo.value).toBe(true);
    });

    it('undoes changes', () => {
        const { content, history } = createHistoryWithContent();
        const original = JSON.parse(JSON.stringify(content.value));

        history.record();
        content.value = {
            ...content.value,
            blocks: [createTextBlock()],
        };

        history.undo();
        expect(content.value.blocks).toEqual(original.blocks);
        expect(history.canRedo.value).toBe(true);
    });

    it('redoes changes', () => {
        const { content, history } = createHistoryWithContent();
        history.record();
        const block = createTextBlock();
        content.value = { ...content.value, blocks: [block] };

        history.undo();
        history.redo();
        expect(content.value.blocks).toHaveLength(1);
    });

    it('clears stacks', () => {
        const { history } = createHistoryWithContent();
        history.record();
        history.clear();
        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(false);
    });

    it('clears redo stack on new record', () => {
        const { content, history } = createHistoryWithContent();
        history.record();
        content.value = { ...content.value, blocks: [createTextBlock()] };
        history.undo();
        expect(history.canRedo.value).toBe(true);

        history.record();
        expect(history.canRedo.value).toBe(false);
    });

    it('respects max stack size', () => {
        const { history } = createHistoryWithContent();
        for (let i = 0; i < 60; i++) {
            history.record();
        }
        // Default maxSize is 50
        history.undo();
        let count = 1;
        while (history.canUndo.value) {
            history.undo();
            count++;
        }
        expect(count).toBeLessThanOrEqual(50);
    });
});
