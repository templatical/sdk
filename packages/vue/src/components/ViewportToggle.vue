<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import type { ViewportSize } from '@templatical/types';
import { Monitor, Smartphone, Tablet } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
    viewport: ViewportSize;
}>();

const emit = defineEmits<{
    (e: 'change', viewport: ViewportSize): void;
}>();

const { t } = useI18n();

const viewports = computed(() => [
    { value: 'desktop' as ViewportSize, label: t.viewport.desktop },
    { value: 'tablet' as ViewportSize, label: t.viewport.tablet },
    { value: 'mobile' as ViewportSize, label: t.viewport.mobile },
]);

const pillOffset = computed(() => {
    const index = viewports.value.findIndex(
        (vp) => vp.value === props.viewport,
    );
    return `translateX(${index * 100}%)`;
});
</script>

<template>
    <div
        role="radiogroup"
        aria-label="Viewport"
        class="tpl:relative tpl:grid tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1"
        :style="{
            gridTemplateColumns: `repeat(${viewports.length}, 1fr)`,
            backgroundColor: 'var(--tpl-bg-hover)',
        }"
    >
        <!-- Sliding pill -->
        <div
            class="tpl:absolute tpl:inset-y-1 tpl:rounded-[var(--tpl-radius-sm)]"
            :style="{
                left: '4px',
                width: `calc((100% - 8px) / ${viewports.length})`,
                transform: pillOffset,
                backgroundColor: 'var(--tpl-bg)',
                boxShadow: 'var(--tpl-shadow)',
                transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
            }"
        ></div>

        <button
            v-for="vp in viewports"
            :key="vp.value"
            role="radio"
            :aria-checked="viewport === vp.value"
            :aria-label="vp.label"
            class="tpl:relative tpl:z-10 tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium"
            :style="{
                color:
                    viewport === vp.value
                        ? 'var(--tpl-primary)'
                        : 'var(--tpl-text-muted)',
                transition: 'color 120ms cubic-bezier(0.16, 1, 0.3, 1)',
            }"
            :title="vp.label"
            @click="emit('change', vp.value)"
        >
            <Monitor
                v-if="vp.value === 'desktop'"
                :size="18"
                :stroke-width="1.5"
            />
            <Tablet
                v-else-if="vp.value === 'tablet'"
                :size="18"
                :stroke-width="1.5"
            />
            <Smartphone v-else :size="18" :stroke-width="1.5" />
            <span>{{ vp.label }}</span>
        </button>
    </div>
</template>
