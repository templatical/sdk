import { describe, expect, it, vi } from 'vitest';
import { ref } from '@vue/reactivity';
import { createDefaultTemplateContent, createParagraphBlock } from '@templatical/types';
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
            blocks: [createParagraphBlock()],
        };
        expect(history.canUndo.value).toBe(true);
    });

    it('undoes changes', () => {
        const { content, history } = createHistoryWithContent();
        const original = JSON.parse(JSON.stringify(content.value));

        history.record();
        content.value = {
            ...content.value,
            blocks: [createParagraphBlock()],
        };

        history.undo();
        expect(content.value.blocks).toEqual(original.blocks);
        expect(history.canRedo.value).toBe(true);
    });

    it('redoes changes', () => {
        const { content, history } = createHistoryWithContent();
        history.record();
        const block = createParagraphBlock();
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
        content.value = { ...content.value, blocks: [createParagraphBlock()] };
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

describe('recordDebounced', () => {
    it('records snapshot on first call', () => {
        const { history } = createHistoryWithContent();
        history.recordDebounced('block-1');
        expect(history.canUndo.value).toBe(true);
    });

    it('does not add extra snapshot for same blockId within debounce window', () => {
        const { history } = createHistoryWithContent();
        history.recordDebounced('block-1');
        history.recordDebounced('block-1');
        history.recordDebounced('block-1');

        // Only one undo snapshot should exist
        history.undo();
        expect(history.canUndo.value).toBe(false);
    });

    it('records new snapshot when blockId changes', () => {
        const { content, history } = createHistoryWithContent();

        history.recordDebounced('block-1');
        content.value = { ...content.value, blocks: [createParagraphBlock()] };

        history.recordDebounced('block-2');

        // Should have two undo snapshots
        history.undo();
        expect(history.canUndo.value).toBe(true);
    });

    it('clears redo stack on record', () => {
        const { content, history } = createHistoryWithContent();
        history.record();
        content.value = { ...content.value, blocks: [createParagraphBlock()] };
        history.undo();
        expect(history.canRedo.value).toBe(true);

        history.recordDebounced('block-1');
        expect(history.canRedo.value).toBe(false);
    });

    it('skips recording when isRemoteOperation returns true', () => {
        const content = ref(createDefaultTemplateContent());
        const setContent = (c: any) => { content.value = c; };
        const history = useHistory({
            content,
            setContent,
            isRemoteOperation: () => true,
        });

        history.recordDebounced('block-1');
        expect(history.canUndo.value).toBe(false);
    });
});

describe('isRemoteOperation', () => {
    it('record skips when isRemoteOperation returns true', () => {
        const content = ref(createDefaultTemplateContent());
        const setContent = (c: any) => { content.value = c; };
        const history = useHistory({
            content,
            setContent,
            isRemoteOperation: () => true,
        });

        history.record();
        expect(history.canUndo.value).toBe(false);
    });
});

describe('destroy', () => {
    it('clears stacks and cancels timers', () => {
        const { history } = createHistoryWithContent();
        history.record();
        history.undo(); // sets isNavigating

        history.destroy();

        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(false);
    });
});

describe('undo/redo edge cases', () => {
    it('undo on empty stack is a no-op', () => {
        const { content, history } = createHistoryWithContent();
        const before = JSON.stringify(content.value);
        history.undo();
        expect(JSON.stringify(content.value)).toBe(before);
    });

    it('redo on empty stack is a no-op', () => {
        const { content, history } = createHistoryWithContent();
        const before = JSON.stringify(content.value);
        history.redo();
        expect(JSON.stringify(content.value)).toBe(before);
    });

    it('isNavigating is set during undo', () => {
        const { history } = createHistoryWithContent();
        history.record();
        history.undo();
        expect(history.isNavigating.value).toBe(true);
    });

    it('undo when stack has only 1 item restores that snapshot and empties undo stack', () => {
        const { content, history } = createHistoryWithContent();
        const originalBlocks = JSON.parse(JSON.stringify(content.value.blocks));

        history.record(); // snapshot the original state
        content.value = { ...content.value, blocks: [createParagraphBlock()] };

        expect(history.canUndo.value).toBe(true);
        history.undo();
        expect(content.value.blocks).toEqual(originalBlocks);
        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(true);
    });

    it('redo when redo stack is empty is a no-op', () => {
        const { content, history } = createHistoryWithContent();
        history.record();
        // Do not undo, so redo stack stays empty
        expect(history.canRedo.value).toBe(false);
        const before = JSON.stringify(content.value);
        history.redo();
        expect(JSON.stringify(content.value)).toBe(before);
        expect(history.canRedo.value).toBe(false);
    });

    it('record called multiple times without changes creates duplicate snapshots', () => {
        const { history } = createHistoryWithContent();
        history.record();
        history.record();
        history.record();

        // All three records pushed to undo stack
        let count = 0;
        while (history.canUndo.value) {
            history.undo();
            count++;
        }
        expect(count).toBe(3);
    });

    it('destroy called twice is idempotent', () => {
        const { history } = createHistoryWithContent();
        history.record();
        history.undo();

        history.destroy();
        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(false);

        // Second destroy should not throw
        history.destroy();
        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(false);
    });

    it('recordDebounced with rapid alternation between different blockIds creates multiple snapshots', () => {
        const { history } = createHistoryWithContent();

        history.recordDebounced('block-a');
        history.recordDebounced('block-b');
        history.recordDebounced('block-a');
        history.recordDebounced('block-b');

        // Each blockId change triggers a new snapshot: a, b, a, b = 4 snapshots
        let count = 0;
        while (history.canUndo.value) {
            history.undo();
            count++;
        }
        expect(count).toBe(4);
    });

    it('custom maxSize=1 keeps only the most recent snapshot', () => {
        const content = ref(createDefaultTemplateContent());
        const setContent = (c: any, _markDirty?: boolean) => {
            content.value = c;
        };
        const history = useHistory({ content, setContent, maxSize: 1 });

        history.record(); // snapshot 1
        content.value = { ...content.value, blocks: [createParagraphBlock()] };
        history.record(); // snapshot 2 (should evict snapshot 1)
        content.value = { ...content.value, blocks: [createParagraphBlock(), createParagraphBlock()] };

        // Only 1 undo should be possible
        history.undo();
        expect(history.canUndo.value).toBe(false);
    });
});
