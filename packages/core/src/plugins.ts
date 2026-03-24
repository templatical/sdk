import type { Block, TemplateContent, TemplateSettings, ViewportSize } from '@templatical/types';
import type { Ref, DeepReadonly } from '@vue/reactivity';
import type { EditorState } from './editor';

export interface EditorPlugin {
    name: string;
    install(context: EditorPluginContext): void | Promise<void>;
    destroy?(): void;
}

export interface EditorPluginContext {
    readonly state: DeepReadonly<EditorState>;
    readonly content: Ref<TemplateContent>;
    readonly selectedBlockId: DeepReadonly<EditorState>['selectedBlockId'];
    readonly viewport: DeepReadonly<EditorState>['viewport'];

    addBlock(block: Block, targetSectionId?: string, columnIndex?: number, index?: number): void;
    updateBlock(blockId: string, updates: Partial<Block>): void;
    removeBlock(blockId: string): void;
    moveBlock(blockId: string, newIndex: number, targetSectionId?: string, columnIndex?: number): void;
    updateSettings(updates: Partial<TemplateSettings>): void;
    selectBlock(blockId: string | null): void;

    registerToolbarAction(action: ToolbarAction): void;
    registerSidebarPanel(panel: SidebarPanel): void;
    registerBlockAction(action: BlockContextAction): void;
}

export interface ToolbarAction {
    id: string;
    icon: string;
    label: string;
    onClick: () => void;
    position?: 'left' | 'right';
}

export interface SidebarPanel {
    id: string;
    icon: string;
    label: string;
    component: unknown;
    position?: 'left' | 'right';
}

export interface BlockContextAction {
    id: string;
    icon: string;
    label: string;
    onClick: (blockId: string) => void;
}
