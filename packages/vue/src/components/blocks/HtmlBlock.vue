<script setup lang="ts">
import { useI18n } from '../../composables/useI18n';
import type {
    HtmlBlock as HtmlBlockType,
    ViewportSize,
} from '@templatical/types';
import { Code } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
    block: HtmlBlockType;
    viewport: ViewportSize;
}>();

const { t } = useI18n();

const hasContent = computed(() => props.block.content.trim().length > 0);
</script>

<template>
    <div class="tpl:w-full">
        <div
            class="tpl:flex tpl:min-h-[80px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border tpl:border-dashed tpl:py-4"
            style="
                border-color: var(--tpl-border);
                background-color: var(--tpl-bg-hover);
            "
        >
            <Code :size="24" style="color: var(--tpl-text-dim)" />
            <span
                v-if="hasContent"
                class="tpl:text-sm"
                style="color: var(--tpl-text-muted)"
            >
                {{ t.html.preview }}
            </span>
            <span v-else class="tpl:text-sm" style="color: var(--tpl-text-dim)">
                {{ t.html.empty }}
            </span>
        </div>
    </div>
</template>
