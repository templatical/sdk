import { describe, expect, it, vi } from 'vitest';
import { handleOperation } from '../../src/cloud/mcp-operation-handler';
import type { UseEditorReturn } from '../../src/cloud/editor';

function createMockEditor(): UseEditorReturn {
  return {
    addBlock: vi.fn(),
    updateBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    updateSettings: vi.fn(),
    setContent: vi.fn(),
  } as unknown as UseEditorReturn;
}

describe('handleOperation', () => {
  it('handles addBlock operation', () => {
    const editor = createMockEditor();
    const block = { id: 'b1', type: 'paragraph' };

    handleOperation(editor, {
      operation: 'addBlock',
      data: { block, sectionId: 's1', columnIndex: 0, index: 2 },
    });

    expect(editor.addBlock).toHaveBeenCalledWith(block, 's1', 0, 2);
  });

  it('handles addBlock without optional params', () => {
    const editor = createMockEditor();
    const block = { id: 'b1', type: 'paragraph' };

    handleOperation(editor, {
      operation: 'addBlock',
      data: { block },
    });

    expect(editor.addBlock).toHaveBeenCalledWith(block, undefined, undefined, undefined);
  });

  it('handles updateBlock operation', () => {
    const editor = createMockEditor();
    const updates = { content: '<p>Updated</p>' };

    handleOperation(editor, {
      operation: 'updateBlock',
      data: { blockId: 'b1', updates },
    });

    expect(editor.updateBlock).toHaveBeenCalledWith('b1', updates);
  });

  it('handles deleteBlock operation', () => {
    const editor = createMockEditor();

    handleOperation(editor, {
      operation: 'deleteBlock',
      data: { blockId: 'b1' },
    });

    expect(editor.removeBlock).toHaveBeenCalledWith('b1');
  });

  it('handles moveBlock operation', () => {
    const editor = createMockEditor();

    handleOperation(editor, {
      operation: 'moveBlock',
      data: { blockId: 'b1', index: 3, sectionId: 's2', columnIndex: 1 },
    });

    expect(editor.moveBlock).toHaveBeenCalledWith('b1', 3, 's2', 1);
  });

  it('handles updateSettings operation', () => {
    const editor = createMockEditor();
    const updates = { width: 700 };

    handleOperation(editor, {
      operation: 'updateSettings',
      data: { updates },
    });

    expect(editor.updateSettings).toHaveBeenCalledWith(updates);
  });

  it('handles setContent operation', () => {
    const editor = createMockEditor();
    const content = { blocks: [], settings: {} };

    handleOperation(editor, {
      operation: 'setContent',
      data: { content },
    });

    expect(editor.setContent).toHaveBeenCalledWith(content);
  });

  it('handles updateBlockStyle operation', () => {
    const editor = createMockEditor();
    const styles = { backgroundColor: '#fff' };

    handleOperation(editor, {
      operation: 'updateBlockStyle',
      data: { blockId: 'b1', styles },
    });

    expect(editor.updateBlock).toHaveBeenCalledWith('b1', { styles });
  });

  it('ignores unknown operations', () => {
    const editor = createMockEditor();

    handleOperation(editor, {
      operation: 'unknown_op' as any,
      data: {},
    });

    expect(editor.addBlock).not.toHaveBeenCalled();
    expect(editor.updateBlock).not.toHaveBeenCalled();
    expect(editor.removeBlock).not.toHaveBeenCalled();
    expect(editor.moveBlock).not.toHaveBeenCalled();
    expect(editor.updateSettings).not.toHaveBeenCalled();
    expect(editor.setContent).not.toHaveBeenCalled();
  });
});
