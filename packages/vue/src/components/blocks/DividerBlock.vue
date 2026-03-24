<script setup lang="ts">
import type {
    DividerBlock as DividerBlockType,
    ViewportSize,
} from '@templatical/types';
import { computed } from 'vue';

const props = defineProps<{
    block: DividerBlockType;
    viewport: ViewportSize;
}>();

const dividerStyle = computed(() => ({
    borderTop: `${props.block.thickness}px ${props.block.lineStyle} ${props.block.color}`,
    width: props.block.width === 'full' ? '100%' : `${props.block.width}px`,
    margin: props.block.width === 'full' ? '0' : '0 auto',
}));
</script>

<template>
    <div class="tpl:w-full">
        <hr class="tpl:m-0 tpl:border-none" :style="dividerStyle" />
    </div>
</template>
