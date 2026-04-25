<script setup lang="ts">
import MarkdownRender from '@/components/shared/MarkdownRender.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import faqMd from '@/content/faq.md?raw';
</script>

<template>
    <PageHeader eyebrow="FAQ" title="Questions, answered." />

    <section class="mx-auto max-w-3xl px-6 pb-24">
        <MarkdownRender :source="faqMd" />
    </section>
</template>
