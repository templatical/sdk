<script setup lang="ts">
import BlockWrapper from './BlockWrapper.vue';
import ButtonBlock from './ButtonBlock.vue';
import CustomBlock from './CustomBlock.vue';
import DividerBlock from './DividerBlock.vue';
import ImageBlock from './ImageBlock.vue';
import TextBlock from './TextBlock.vue';
import {
    useI18n,
    type UseBlockRegistryReturn,
} from '../../composables';
import type {
    UseConditionPreviewReturn,
    UseEditorReturn,
} from '@templatical/core';
import type {
    Block,
    CustomBlock as CustomBlockType,
    SectionBlock as SectionBlockType,
    ViewportSize,
} from '@templatical/types';
import { computed, inject, type Component } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps<{
    block: SectionBlockType;
    viewport: ViewportSize;
}>();

const { t } = useI18n();
const editor = inject<UseEditorReturn>('editor')!;
const conditionPreview = inject<UseConditionPreviewReturn>('conditionPreview');
const blockRegistry =
    inject<UseBlockRegistryReturn>('blockRegistry');

const columnWidths = computed(() => {
    switch (props.block.columns) {
        case '2':
            return ['50%', '50%'];
        case '3':
            return ['33.33%', '33.33%', '33.33%'];
        case '1-2':
            return ['33.33%', '66.67%'];
        case '2-1':
            return ['66.67%', '33.33%'];
        default:
            return ['100%'];
    }
});

const columns = computed(() => {
    const count = columnWidths.value.length;
    const children = [...props.block.children];
    while (children.length < count) {
        children.push([]);
    }
    return children.slice(0, count);
});

function getColumnBlocks(colIndex: number): Block[] {
    return columns.value[colIndex] || [];
}

function setColumnBlocks(colIndex: number, blocks: Block[]): void {
    const newChildren = [...props.block.children];
    while (newChildren.length <= colIndex) {
        newChildren.push([]);
    }
    newChildren[colIndex] = blocks;
    editor.updateBlock(props.block.id, { children: newChildren });
}

function getBlockComponent(block: Block): Component | null {
    if (blockRegistry) {
        const component = blockRegistry.getComponent(block);
        if (component) {
            return component;
        }
    }

    switch (block.type) {
        case 'text':
            return TextBlock;
        case 'image':
            return ImageBlock;
        case 'button':
            return ButtonBlock;
        case 'divider':
            return DividerBlock;
        case 'custom':
            return CustomBlock;
        default:
            return null;
    }
}

function handleFetchData(
    block: Block,
    payload: {
        fieldValues: Record<string, unknown>;
        dataSourceFetched: boolean;
    },
): void {
    if (block.type !== 'custom') {
        return;
    }

    editor.updateBlock(block.id, {
        fieldValues: payload.fieldValues,
        dataSourceFetched: payload.dataSourceFetched,
    } as Partial<CustomBlockType>);
}
</script>

<template>
    <div class="tpl:w-full">
        <div class="tpl:flex tpl:gap-0">
            <div
                v-for="(_, colIndex) in columns"
                :key="colIndex"
                class="tpl:relative tpl:min-h-[60px] tpl:rounded"
                :class="
                    getColumnBlocks(colIndex).length === 0
                        ? 'tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)]'
                        : ''
                "
                :style="{ width: columnWidths[colIndex] }"
            >
                <draggable
                    :model-value="getColumnBlocks(colIndex)"
                    :group="{
                        name: 'blocks',
                        pull: true,
                        put: (to, from, el) =>
                            el.dataset.blockType !== 'section',
                    }"
                    item-key="id"
                    :animation="150"
                    ghost-class="tpl-ghost"
                    :empty-insert-threshold="20"
                    class="tpl:min-h-[60px]"
                    @update:model-value="
                        (val) => setColumnBlocks(colIndex, val)
                    "
                >
                    <template #item="{ element: childBlock }">
                        <div
                            v-show="!conditionPreview?.isHidden(childBlock.id)"
                        >
                            <BlockWrapper
                                :block="childBlock"
                                :is-selected="
                                    editor.state.selectedBlockId ===
                                    childBlock.id
                                "
                                :viewport="viewport"
                                @select="editor.selectBlock(childBlock.id)"
                            >
                                <component
                                    :is="getBlockComponent(childBlock)"
                                    :block="childBlock"
                                    :viewport="viewport"
                                    @fetch-data="
                                        handleFetchData(childBlock, $event)
                                    "
                                />
                            </BlockWrapper>
                        </div>
                    </template>
                </draggable>
                <div
                    v-if="getColumnBlocks(colIndex).length === 0"
                    class="tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:flex tpl:items-center tpl:justify-center tpl:text-xs"
                    style="color: var(--tpl-text-dim)"
                >
                    <span>{{ t.section.dropHere }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
