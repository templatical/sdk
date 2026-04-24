<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps<{
    to?: string;
    href?: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit';
    disabled?: boolean;
}>();

const variant = computed(() => props.variant ?? 'primary');
const size = computed(() => props.size ?? 'md');

const sizeClasses = computed(() =>
    size.value === 'sm'
        ? 'min-h-9 px-3 py-1.5 text-sm'
        : size.value === 'lg'
          ? 'min-h-12 px-6 py-3 text-base'
          : 'min-h-11 px-4 py-2 text-sm',
);

const variantClasses = computed(() =>
    variant.value === 'primary'
        ? 'bg-primary text-primary-contrast hover:bg-primary-hover active:bg-primary-hover active:brightness-95 shadow-sm'
        : variant.value === 'secondary'
          ? 'bg-bg-elevated text-text border border-border hover:bg-bg-hover active:bg-bg-active'
          : 'bg-transparent text-text hover:bg-bg-hover active:bg-bg-active',
);

const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap';
</script>

<template>
    <RouterLink
        v-if="to"
        :to="to"
        :class="[base, sizeClasses, variantClasses]"
    >
        <slot />
    </RouterLink>
    <a
        v-else-if="href"
        :href="href"
        :class="[base, sizeClasses, variantClasses]"
        target="_blank"
        rel="noopener"
    >
        <slot />
    </a>
    <button
        v-else
        :type="type ?? 'button'"
        :disabled="disabled"
        :class="[base, sizeClasses, variantClasses]"
    >
        <slot />
    </button>
</template>
