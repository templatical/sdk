<script setup lang="ts">
import Icon from './Icon.vue';
import type { Feature } from '@/features';

defineProps<{ feature: Feature; compact?: boolean }>();
</script>

<template>
    <RouterLink
        :to="`/features/${feature.slug}`"
        class="reveal group relative flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-6 [content-visibility:auto] [contain-intrinsic-size:auto_220px] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
    >
        <div class="flex items-center justify-between">
            <span
                class="inline-flex size-10 items-center justify-center rounded-md bg-primary-light text-primary-hover transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-contrast"
            >
                <Icon :name="feature.icon" :size="20" aria-hidden="true" />
            </span>
            <span
                v-if="feature.badge"
                class="rounded-sm bg-secondary-light px-2 py-0.5 text-xs font-medium text-secondary-hover"
            >
                {{ feature.badge }}
            </span>
        </div>
        <div class="min-w-0">
            <h3 class="line-clamp-2 text-base font-semibold text-text">
                {{ feature.title }}
            </h3>
            <p class="mt-1 line-clamp-2 text-sm text-text-muted">
                {{ feature.tagline }}
            </p>
        </div>
        <p
            v-if="!compact"
            class="line-clamp-3 text-sm leading-relaxed text-text-muted"
        >
            {{ feature.summary }}
        </p>
        <span
            class="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
            Learn more
            <Icon name="arrow" :size="14" aria-hidden="true" />
        </span>
    </RouterLink>
</template>
