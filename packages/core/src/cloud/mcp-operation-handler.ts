import type { McpOperationPayload } from '@templatical/types';
import type { Block, TemplateContent, TemplateSettings } from '@templatical/types';
import type { UseEditorReturn } from './editor';

export function handleOperation(
    editor: UseEditorReturn,
    payload: McpOperationPayload,
): void {
    const { operation, data } = payload;

    switch (operation) {
        case 'add_block':
            editor.addBlock(
                data.block as Block,
                data.section_id as string | undefined,
                data.column_index as number | undefined,
                data.index as number | undefined,
            );
            break;

        case 'update_block':
            editor.updateBlock(
                data.block_id as string,
                data.updates as Partial<Block>,
            );
            break;

        case 'delete_block':
            editor.removeBlock(data.block_id as string);
            break;

        case 'move_block':
            editor.moveBlock(
                data.block_id as string,
                data.index as number,
                data.section_id as string | undefined,
                data.column_index as number | undefined,
            );
            break;

        case 'update_settings':
            editor.updateSettings(data.updates as Partial<TemplateSettings>);
            break;

        case 'set_content':
            editor.setContent(data.content as TemplateContent);
            break;

        case 'update_block_style':
            editor.updateBlock(
                data.block_id as string,
                {
                    styles: data.styles,
                } as Partial<Block>,
            );
            break;
    }
}
