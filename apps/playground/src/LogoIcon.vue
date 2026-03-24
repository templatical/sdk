<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    size?: number;
}>(), {
    size: 32,
});

const maskId = computed(() => `logo-${Math.random().toString(36).slice(2, 8)}`);
</script>

<template>
    <svg :width="size" :height="size" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
            <mask :id="maskId">
                <rect width="32" height="32" fill="white"/>
                <rect x="6" y="9" width="10" height="1.8" rx="0.9" fill="black"/>
                <rect x="6" y="13.5" width="7" height="1.5" rx="0.75" fill="black"/>
                <rect x="6" y="17" width="9" height="1.5" rx="0.75" fill="black"/>
                <rect x="6" y="20.5" width="5" height="1.5" rx="0.75" fill="black"/>
            </mask>
        </defs>
        <rect x="10" y="1" width="18" height="22" rx="3" fill="#d4d4d4" transform="rotate(8 19 12)"/>
        <rect x="6" y="2" width="18" height="22" rx="3" fill="#a3a3a3" transform="rotate(-4 15 13)"/>
        <rect x="2" y="4" width="18" height="22" rx="3" fill="#525252" :mask="`url(#${maskId})`"/>
    </svg>
</template>
