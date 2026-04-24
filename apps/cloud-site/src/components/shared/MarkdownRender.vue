<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{ source: string }>();

marked.setOptions({ gfm: true, breaks: false });

const html = computed(() => marked.parse(props.source) as string);
</script>

<template>
    <div class="prose-content" v-html="html" />
</template>

<style scoped>
.prose-content :deep(h1) {
    font-size: 2.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
}
.prose-content :deep(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 2.5rem 0 1rem;
}
.prose-content :deep(h3) {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 1.75rem 0 0.5rem;
}
.prose-content :deep(p),
.prose-content :deep(ul),
.prose-content :deep(ol) {
    max-width: 65ch;
}
.prose-content :deep(p) {
    margin: 0 0 1rem;
    color: var(--text-muted);
    line-height: 1.65;
}
.prose-content :deep(ul),
.prose-content :deep(ol) {
    margin: 0 0 1rem;
    padding-left: 1.5rem;
    color: var(--text-muted);
}
.prose-content :deep(li) {
    margin: 0.25rem 0;
    line-height: 1.65;
}
.prose-content :deep(a) {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 3px;
    overflow-wrap: anywhere;
}
.prose-content :deep(h1),
.prose-content :deep(h2),
.prose-content :deep(h3) {
    overflow-wrap: anywhere;
}
.prose-content :deep(strong) {
    color: var(--text);
    font-weight: 600;
}
.prose-content :deep(code) {
    background: var(--bg-hover);
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-sm);
    font-size: 0.875em;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.prose-content :deep(pre) {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    padding: 1rem 1.25rem;
    border-radius: var(--radius);
    overflow-x: auto;
    margin: 1.25rem 0;
}
.prose-content :deep(pre code) {
    background: transparent;
    padding: 0;
}
.prose-content :deep(blockquote) {
    margin: 1.5rem 0 1.5rem 1.5rem;
    color: var(--text);
    font-style: italic;
}
.prose-content :deep(blockquote p) {
    color: var(--text);
}
.prose-content :deep(hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2rem 0;
}
</style>
