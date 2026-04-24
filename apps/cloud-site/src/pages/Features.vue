<script setup lang="ts">
import { computed } from 'vue';
import { features } from '@/features';
import FeatureCard from '@/components/shared/FeatureCard.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { useScrollReveal } from '@/composables/useScrollReveal';

useScrollReveal();

const flagship = computed(() => features.slice(0, 3));
const rest = computed(() => features.slice(3));
</script>

<template>
    <PageHeader
        eyebrow="Features"
        title="Everything Cloud adds to the editor."
        :lede="`${features.length} additions that turn the open-source editor into a platform your whole team ships with.`"
    />

    <section class="mx-auto max-w-6xl px-6 pb-8">
        <div class="grid gap-4 md:grid-cols-3">
            <FeatureCard
                v-for="f in flagship"
                :key="f.slug"
                :feature="f"
            />
        </div>
    </section>

    <section class="mx-auto max-w-6xl px-6 pb-24">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
                v-for="f in rest"
                :key="f.slug"
                :feature="f"
                compact
            />
        </div>
    </section>
</template>
