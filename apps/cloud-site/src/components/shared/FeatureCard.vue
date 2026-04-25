<script setup lang="ts">
import Icon from './Icon.vue';
import type { Feature } from '@/features';

defineProps<{ feature: Feature; compact?: boolean }>();
</script>

<template>
    <RouterLink
        :to="`/features/${feature.slug}`"
        class="reveal group flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-6 [content-visibility:auto] [contain-intrinsic-size:auto_200px] transition-colors duration-200 hover:border-border-strong"
    >
        <Icon
            :name="feature.icon"
            :size="20"
            class="text-primary-hover"
            aria-hidden="true"
        />
        <div class="min-w-0">
            <h3 class="text-base font-semibold text-text [overflow-wrap:anywhere]">
                {{ feature.title }}
            </h3>
            <p class="mt-1 text-sm text-text-muted [overflow-wrap:anywhere]">
                {{ feature.tagline }}
            </p>
        </div>
        <p
            v-if="!compact"
            class="line-clamp-3 text-sm leading-relaxed text-text-muted"
        >
            {{ feature.summary }}
        </p>
    </RouterLink>
</template>
