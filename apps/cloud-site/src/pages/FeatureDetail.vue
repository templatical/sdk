<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { features, findFeature } from '@/features';
import Icon from '@/components/shared/Icon.vue';
import MarkdownRender from '@/components/shared/MarkdownRender.vue';
import Button from '@/components/shared/Button.vue';

const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ''));
const feature = computed(() => findFeature(slug.value));

const contentModules = import.meta.glob('../content/features/*.md', {
    query: '?raw',
    import: 'default',
});

const content = ref('');

watch(
    slug,
    async (s) => {
        const loader = contentModules[`../content/features/${s}.md`];
        content.value = loader ? ((await loader()) as string) : '';
    },
    { immediate: true },
);

const nextFeature = computed(() => {
    if (features.length < 2 || !feature.value) return null;
    const idx = features.findIndex((f) => f.slug === feature.value!.slug);
    return features[(idx + 1) % features.length];
});
</script>

<template>
    <article v-if="feature" class="mx-auto max-w-3xl px-6 pt-16 pb-10">
        <RouterLink
            to="/features"
            class="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
        >
            <Icon name="arrow" :size="14" class="rotate-180" />
            All features
        </RouterLink>
        <div class="mt-8">
            <Icon
                :name="feature.icon"
                :size="24"
                class="text-primary-hover"
                aria-hidden="true"
            />
            <h1 class="mt-4 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
                {{ feature.title }}
            </h1>
            <p class="mt-2 text-base text-text-muted">{{ feature.tagline }}</p>
        </div>
        <p class="mt-8 text-lg leading-relaxed text-text-muted">
            {{ feature.summary }}
        </p>
        <div class="mt-12">
            <MarkdownRender v-if="content" :source="content" />
        </div>
    </article>

    <section v-else class="mx-auto max-w-3xl px-6 py-24">
        <h1 class="text-3xl font-semibold text-text">Feature not found</h1>
        <p class="mt-3 text-text-muted">
            That slug doesn't match any of our planned features.
        </p>
        <div class="mt-6">
            <Button to="/features" variant="primary">See all features</Button>
        </div>
    </section>

    <template v-if="feature && nextFeature">
        <section class="mx-auto max-w-3xl px-6 pb-20">
            <RouterLink
                :to="`/features/${nextFeature.slug}`"
                class="group flex items-baseline justify-between gap-6 border-t border-border pt-8 text-text"
            >
                <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase tracking-widest text-text-dim">
                        Next
                    </p>
                    <p class="mt-2 truncate text-xl font-semibold tracking-tight">
                        {{ nextFeature.title }}
                    </p>
                </div>
                <Icon
                    name="arrow"
                    :size="20"
                    class="shrink-0 text-text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-text"
                    aria-hidden="true"
                />
            </RouterLink>
        </section>
    </template>
</template>
