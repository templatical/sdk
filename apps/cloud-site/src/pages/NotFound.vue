<script setup lang="ts">
import Button from '@/components/shared/Button.vue';
</script>

<template>
    <section class="mx-auto max-w-xl px-6 py-32 text-center">
        <p class="text-7xl font-semibold text-primary">404</p>
        <h1 class="mt-6 text-2xl font-semibold text-text">
            Page not found
        </h1>
        <p class="mt-3 text-text-muted">
            That link doesn’t lead anywhere. Try the homepage or the features list.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button to="/" variant="primary">Home</Button>
            <Button to="/features" variant="secondary">Features</Button>
        </div>
    </section>
</template>
