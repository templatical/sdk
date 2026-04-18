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
  it('handles add_block operation', () => {
    const editor = createMockEditor();
    const block = { id: 'b1', type: 'paragraph' };

    handleOperation(editor, {
      operation: 'add_block',
      data: { block, section_id: 's1', column_index: 0, index: 2 },
    });

    expect(editor.addBlock).toHaveBeenCalledWith(block, 's1', 0, 2);
  });

  it('handles add_block without optional params', () => {
    const editor = createMockEditor();
    const block = { id: 'b1', type: 'paragraph' };

    handleOperation(editor, {
      operation: 'add_block',
      data: { block },
    });

    expect(editor.addBlock).toHaveBeenCalledWith(block, undefined, undefined, undefined);
  });

  it('handles update_block operation', () => {
    const editor = createMockEditor();
    const updates = { content: '<p>Updated</p>' };

    handleOperation(editor, {
      operation: 'update_block',
      data: { block_id: 'b1', updates },
    });

    expect(editor.updateBlock).toHaveBeenCalledWith('b1', updates);
  });

  it('handles delete_block operation', () => {
    const editor = createMockEditor();

    handleOperation(editor, {
      operation: 'delete_block',
      data: { block_id: 'b1' },
    });

    expect(editor.removeBlock).toHaveBeenCalledWith('b1');
  });

  it('handles move_block operation', () => {
    const editor = createMockEditor();

    handleOperation(editor, {
      operation: 'move_block',
      data: { block_id: 'b1', index: 3, section_id: 's2', column_index: 1 },
    });

    expect(editor.moveBlock).toHaveBeenCalledWith('b1', 3, 's2', 1);
  });

  it('handles update_settings operation', () => {
    const editor = createMockEditor();
    const updates = { width: 700 };

    handleOperation(editor, {
      operation: 'update_settings',
      data: { updates },
    });

    expect(editor.updateSettings).toHaveBeenCalledWith(updates);
  });

  it('handles set_content operation', () => {
    const editor = createMockEditor();
    const content = { blocks: [], settings: {} };

    handleOperation(editor, {
      operation: 'set_content',
      data: { content },
    });

    expect(editor.setContent).toHaveBeenCalledWith(content);
  });

  it('handles update_block_style operation', () => {
    const editor = createMockEditor();
    const styles = { backgroundColor: '#fff' };

    handleOperation(editor, {
      operation: 'update_block_style',
      data: { block_id: 'b1', styles },
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
