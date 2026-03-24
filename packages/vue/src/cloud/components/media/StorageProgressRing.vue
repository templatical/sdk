<script setup lang="ts">
import { useI18n } from '../../../composables';
import { computed, ref } from 'vue';

const props = defineProps<{
    usedBytes: number;
    limitBytes: number;
    size?: number;
}>();

const { t, format } = useI18n();
const showTooltip = ref(false);

const size = computed(() => props.size ?? 24);
const strokeWidth = computed(() => Math.max(2, size.value / 8));
const radius = computed(() => (size.value - strokeWidth.value) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);

const percentage = computed(() => {
    if (props.limitBytes <= 0) return 0;
    return Math.min(100, (props.usedBytes / props.limitBytes) * 100);
});

const strokeDashoffset = computed(() => {
    return circumference.value - (percentage.value / 100) * circumference.value;
});

const progressColor = computed(() => {
    if (percentage.value >= 95) {
        return 'var(--tpl-danger)';
    }
    if (percentage.value >= 75) {
        return 'var(--tpl-warning, #f59e0b)';
    }
    return 'var(--tpl-primary)';
});

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    // Show 1 decimal for MB/GB, no decimals for B/KB
    const decimals = i >= 2 ? 1 : 0;
    return `${value.toFixed(decimals)} ${sizes[i]}`;
}

const usedFormatted = computed(() => formatBytes(props.usedBytes));
const limitFormatted = computed(() => formatBytes(props.limitBytes));
const remainingBytes = computed(() =>
    Math.max(0, props.limitBytes - props.usedBytes),
);
const remainingFormatted = computed(() => formatBytes(remainingBytes.value));

const tooltipText = computed(() =>
    format(t.mediaLibrary.storageTooltip, {
        used: usedFormatted.value,
        total: limitFormatted.value,
        remaining: remainingFormatted.value,
    }),
);
</script>

<template>
    <div
        class="tpl:relative tpl:inline-flex tpl:cursor-help tpl:items-center tpl:justify-center"
        @mouseenter="showTooltip = true"
        @mouseleave="showTooltip = false"
    >
        <svg
            :width="size"
            :height="size"
            class="tpl:-rotate-90"
            :viewBox="`0 0 ${size} ${size}`"
        >
            <!-- Background circle -->
            <circle
                :cx="size / 2"
                :cy="size / 2"
                :r="radius"
                fill="none"
                :stroke-width="strokeWidth"
                style="stroke: var(--tpl-border)"
            />
            <!-- Progress circle -->
            <circle
                :cx="size / 2"
                :cy="size / 2"
                :r="radius"
                fill="none"
                :stroke-width="strokeWidth"
                :stroke="progressColor"
                stroke-linecap="round"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="strokeDashoffset"
                class="tpl:transition-all tpl:duration-300 tpl:ease-out"
            />
        </svg>

        <!-- Tooltip -->
        <Transition
            enter-active-class="tpl:transition tpl:ease-out tpl:duration-150"
            enter-from-class="tpl:opacity-0 tpl:translate-y-1"
            enter-to-class="tpl:opacity-100 tpl:translate-y-0"
            leave-active-class="tpl:transition tpl:ease-in tpl:duration-100"
            leave-from-class="tpl:opacity-100 tpl:translate-y-0"
            leave-to-class="tpl:opacity-0 tpl:translate-y-1"
        >
            <div
                v-if="showTooltip"
                class="tpl:absolute tpl:top-full tpl:left-1/2 tpl:z-50 tpl:mt-2 tpl:-translate-x-1/2 tpl:rounded-md tpl:px-2.5 tpl:py-1.5 tpl:text-xs tpl:whitespace-nowrap tpl:shadow-lg"
                style="
                    background-color: var(--tpl-text);
                    color: var(--tpl-bg-elevated);
                "
            >
                {{ tooltipText }}
                <div
                    class="tpl:absolute tpl:-top-1 tpl:left-1/2 tpl:size-2 tpl:-translate-x-1/2 tpl:rotate-45"
                    style="background-color: var(--tpl-text)"
                />
            </div>
        </Transition>
    </div>
</template>
