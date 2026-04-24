<script setup lang="ts">
import { features } from '@/features';
import Button from '@/components/shared/Button.vue';
import FeatureCard from '@/components/shared/FeatureCard.vue';
import Icon from '@/components/shared/Icon.vue';
import { useScrollReveal } from '@/composables/useScrollReveal';

useScrollReveal();

const highlights = features.slice(0, 6);
</script>

<template>
    <section class="mx-auto max-w-6xl px-6 pt-16 pb-20 sm:pt-24 md:pt-32">
        <div class="intro max-w-3xl">
            <p class="eyebrow flex items-center gap-2">
                <span class="size-1.5 rounded-full bg-primary"></span>
                In development
            </p>
            <h1
                class="title-tighter mt-6 text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[1.05] text-text"
            >
                The hosted layer for the open-source email editor.
            </h1>
            <p
                class="mt-6 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg"
            >
                AI, MCP, real-time collaboration, comments, a media library,
                template scoring, and a headless API — on top of Templatical's
                OSS Vue 3 editor.
            </p>
            <div class="mt-10 flex flex-wrap items-center gap-3">
                <Button to="/features" variant="primary" size="md">
                    See what's in Cloud
                    <Icon name="arrow" :size="14" />
                </Button>
                <Button
                    href="https://play.templatical.com"
                    variant="secondary"
                    size="md"
                >
                    Try the OSS editor
                </Button>
            </div>
        </div>
    </section>

    <section class="mx-auto max-w-6xl border-t border-border px-6 py-20">
        <div class="reveal mb-12 max-w-2xl">
            <h2
                class="text-3xl font-semibold tracking-tight text-text sm:text-4xl"
            >
                What Cloud adds.
            </h2>
            <p class="mt-3 text-text-muted">
                Six highlights below. {{ features.length - 6 }} more on the
                features page.
            </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
                v-for="f in highlights"
                :key="f.slug"
                :feature="f"
                compact
            />
        </div>
        <div class="mt-8">
            <Button to="/features" variant="ghost" size="md">
                See all {{ features.length }} features
                <Icon name="arrow" :size="14" />
            </Button>
        </div>
    </section>

    <section class="mx-auto max-w-6xl border-t border-border px-6 py-20">
        <div class="reveal grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
                <h2 class="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
                    Self-host the OSS. Flip to Cloud when you need more.
                </h2>
                <p class="mt-4 text-base leading-relaxed text-text-muted">
                    Same editor, same JSON, same MJML renderer. Export
                    templates any time. No proprietary lock-in.
                </p>
                <p class="mt-4 text-base leading-relaxed text-text-muted">
                    The
                    <a
                        href="https://github.com/templatical/sdk"
                        target="_blank"
                        rel="noopener"
                        class="text-primary underline underline-offset-4 hover:text-primary-hover"
                    >open-source core</a>
                    stays open source.
                </p>
            </div>
            <pre class="overflow-x-auto rounded-md border border-border bg-bg-subtle p-5 text-sm leading-relaxed"><code><span class="text-text-dim">// Self-hosted OSS</span>
<span class="text-secondary">import</span> { <span class="text-primary">init</span> } <span class="text-secondary">from</span> <span class="text-success">'@templatical/editor'</span>;

<span class="text-secondary">const</span> editor = <span class="text-secondary">await</span> <span class="text-primary">init</span>({
  container: <span class="text-success">'#editor'</span>,
});

<span class="text-text-dim">// When ready — flip a switch.</span>
<span class="text-secondary">import</span> { <span class="text-primary">initCloud</span> } <span class="text-secondary">from</span> <span class="text-success">'@templatical/editor'</span>;

<span class="text-secondary">const</span> editor = <span class="text-secondary">await</span> <span class="text-primary">initCloud</span>({
  container: <span class="text-success">'#editor'</span>,
  auth: { url: <span class="text-success">'/api/token'</span> },
});</code></pre>
        </div>
    </section>
</template>
