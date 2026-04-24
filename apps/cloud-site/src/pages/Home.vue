<script setup lang="ts">
import { features } from '@/features';
import Button from '@/components/shared/Button.vue';
import FeatureCard from '@/components/shared/FeatureCard.vue';
import Icon from '@/components/shared/Icon.vue';
import HeroAurora from '@/components/shared/HeroAurora.vue';
import HeroHeadline from '@/components/shared/HeroHeadline.vue';
import { useScrollReveal } from '@/composables/useScrollReveal';

useScrollReveal();

const highlights = features.slice(0, 6);
</script>

<template>
    <section class="hero relative overflow-hidden">
        <HeroAurora class="hero__aurora" />
        <div
            class="hero__content relative z-10 mx-auto max-w-6xl px-6 pb-20"
        >
            <div class="intro max-w-3xl">
                <p class="eyebrow flex items-center gap-2">
                    <span class="status-dot">
                        <span class="status-dot__ping"></span>
                        <span class="status-dot__core"></span>
                    </span>
                    In development
                </p>
                <HeroHeadline
                    text="The hosted layer for the open-source email editor."
                    accent="hosted"
                />
                <p
                    class="mt-6 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg"
                >
                    AI, MCP, real-time collaboration, comments, a media
                    library, template scoring, and a headless API — on top
                    of Templatical's OSS Vue 3 editor.
                </p>
                <div class="mt-10 flex flex-wrap items-center gap-3">
                    <Button
                        to="/features"
                        variant="primary"
                        size="md"
                        class="cta-primary"
                    >
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
            <pre class="whitespace-pre-wrap break-words rounded-md border border-border bg-bg-subtle p-5 font-mono text-sm leading-relaxed text-text"><code><span class="tok-comment">// Self-hosted OSS</span>
<span class="tok-keyword">import</span> { <span class="tok-fn">init</span> } <span class="tok-keyword">from</span> <span class="tok-string">'@templatical/editor'</span>;

<span class="tok-keyword">const</span> editor = <span class="tok-keyword">await</span> <span class="tok-fn">init</span>({
  container: <span class="tok-string">'#editor'</span>,
});

<span class="tok-comment">// When ready — flip a switch.</span>
<span class="tok-keyword">import</span> { <span class="tok-fn">initCloud</span> } <span class="tok-keyword">from</span> <span class="tok-string">'@templatical/editor'</span>;

<span class="tok-keyword">const</span> editor = <span class="tok-keyword">await</span> <span class="tok-fn">initCloud</span>({
  container: <span class="tok-string">'#editor'</span>,
  auth: { url: <span class="tok-string">'/api/token'</span> },
});</code></pre>
        </div>
    </section>
</template>

<style scoped>
@property --cta-shine {
    syntax: '<percentage>';
    initial-value: -40%;
    inherits: false;
}

.hero {
    isolation: isolate;
    margin-top: -4rem;
}

.hero__aurora {
    position: absolute;
    inset: 0;
    z-index: 0;
}

.hero__content {
    padding-top: calc(4rem + 4rem);
}
@media (min-width: 640px) {
    .hero__content {
        padding-top: calc(4rem + 6rem);
    }
}
@media (min-width: 768px) {
    .hero__content {
        padding-top: calc(4rem + 8rem);
    }
}

.status-dot {
    position: relative;
    display: inline-flex;
    width: 0.5rem;
    height: 0.5rem;
    align-items: center;
    justify-content: center;
}
.status-dot__core {
    position: relative;
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 9999px;
    background: var(--primary);
    box-shadow: 0 0 0 0 color-mix(in oklch, var(--primary) 50%, transparent);
    animation: status-breathe 2.4s ease-in-out infinite;
}
.status-dot__ping {
    position: absolute;
    inset: -0.25rem;
    border-radius: 9999px;
    background: color-mix(in oklch, var(--primary) 45%, transparent);
    animation: status-ping 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes status-ping {
    0% {
        transform: scale(0.6);
        opacity: 0.7;
    }
    70% {
        transform: scale(1.8);
        opacity: 0;
    }
    100% {
        transform: scale(1.8);
        opacity: 0;
    }
}
@keyframes status-breathe {
    0%,
    100% {
        box-shadow: 0 0 0 0
            color-mix(in oklch, var(--primary) 0%, transparent);
    }
    50% {
        box-shadow: 0 0 0 3px
            color-mix(in oklch, var(--primary) 20%, transparent);
    }
}

.cta-primary {
    position: relative;
    overflow: hidden;
    isolation: isolate;
}
.cta-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        110deg,
        transparent 0%,
        transparent calc(var(--cta-shine) - 5%),
        color-mix(in oklch, white 35%, transparent) var(--cta-shine),
        transparent calc(var(--cta-shine) + 5%),
        transparent 100%
    );
    pointer-events: none;
    transition: --cta-shine 900ms cubic-bezier(0.16, 1, 0.3, 1);
    mix-blend-mode: overlay;
    z-index: 1;
}
.cta-primary:hover::after {
    --cta-shine: 140%;
}

@media (prefers-reduced-motion: reduce) {
    .status-dot__ping,
    .status-dot__core {
        animation: none;
    }
    .cta-primary::after {
        display: none;
    }
}
</style>
