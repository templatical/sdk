<script setup lang="ts">
import { ref, watch } from 'vue';
import { onKeyStroke, useMediaQuery } from '@vueuse/core';
import { RouterLink, useRoute } from 'vue-router';
import Icon from '../shared/Icon.vue';
import ThemeToggle from './ThemeToggle.vue';

const navOpen = ref(false);
const toggleRef = ref<HTMLButtonElement | null>(null);
const route = useRoute();

onKeyStroke('Escape', () => {
    if (navOpen.value) {
        navOpen.value = false;
        toggleRef.value?.focus();
    }
});

watch(() => route.path, () => {
    navOpen.value = false;
});

const isDesktop = useMediaQuery('(min-width: 768px)');
watch(isDesktop, (wide) => {
    if (wide) navOpen.value = false;
});

const links = [
    { to: '/features', label: 'Features' },
    { to: '/compare', label: 'OSS vs Cloud' },
    { to: '/faq', label: 'FAQ' },
];
</script>

<template>
    <header
        class="sticky top-0 z-50 border-b border-border bg-bg"
    >
        <div
            class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
        >
            <RouterLink
                to="/"
                class="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-text"
            >
                <img
                    src="https://templatical.com/logo.svg"
                    alt="Templatical"
                    class="h-6 w-auto"
                    width="24"
                    height="24"
                    decoding="async"
                    fetchpriority="high"
                />
                <span class="text-primary">Cloud</span>
            </RouterLink>

            <nav
                aria-label="Primary"
                class="hidden items-center gap-6 md:flex"
            >
                <RouterLink
                    v-for="link in links"
                    :key="link.to"
                    :to="link.to"
                    class="text-sm text-text-muted transition-colors hover:text-text"
                    active-class="text-text"
                >
                    {{ link.label }}
                </RouterLink>
            </nav>

            <div class="flex items-center gap-3">
                <a
                    href="https://github.com/templatical/sdk"
                    target="_blank"
                    rel="noopener"
                    aria-label="Templatical on GitHub (opens in new tab)"
                    class="hidden size-11 items-center justify-center rounded-md border border-border bg-bg-elevated text-text-muted transition-colors hover:bg-bg-hover hover:text-text sm:inline-flex"
                >
                    <Icon name="github" :size="16" aria-hidden="true" />
                </a>
                <ThemeToggle />
                <button
                    ref="toggleRef"
                    type="button"
                    class="inline-flex size-11 items-center justify-center rounded-md border border-border bg-bg-elevated text-text transition-colors hover:bg-bg-hover md:hidden"
                    aria-label="Toggle menu"
                    aria-controls="mobile-nav"
                    :aria-expanded="navOpen"
                    @click="navOpen = !navOpen"
                >
                    <Icon :name="navOpen ? 'x' : 'menu'" :size="16" aria-hidden="true" />
                </button>
            </div>
        </div>

        <Transition name="menu">
        <div
            v-show="navOpen"
            id="mobile-nav"
            class="origin-top overflow-hidden border-t border-border bg-bg-elevated md:hidden"
        >
            <nav
                aria-label="Mobile"
                class="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4"
            >
                <RouterLink
                    v-for="link in links"
                    :key="link.to"
                    :to="link.to"
                    class="rounded-md px-3 py-3 text-sm text-text-muted hover:bg-bg-hover hover:text-text"
                    active-class="bg-bg-hover text-text"
                    @click="navOpen = false"
                >
                    {{ link.label }}
                </RouterLink>
            </nav>
        </div>
        </Transition>
    </header>
</template>
