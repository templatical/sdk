<script setup lang="ts">
import { RouterLink } from 'vue-router';
import Icon from '../shared/Icon.vue';
</script>

<template>
    <footer class="mt-24 border-t border-border bg-bg-subtle">
        <div
            class="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4"
        >
            <div>
                <div class="flex items-center gap-2 text-sm font-semibold text-text">
                    <img
                        src="https://templatical.com/logo.svg"
                        alt="Templatical"
                        class="h-5 w-auto"
                        width="20"
                        height="20"
                        loading="lazy"
                        decoding="async"
                    />
                    <span class="text-primary">Cloud</span>
                </div>
                <p class="mt-3 text-sm text-text-muted">
                    Premium hosted features for teams building email tooling at
                    scale. Currently in development.
                </p>
            </div>

            <div>
                <h4 class="text-xs font-semibold tracking-wider text-text-dim uppercase">
                    Product
                </h4>
                <ul class="mt-4 space-y-2 text-sm">
                    <li>
                        <RouterLink to="/features" class="text-text-muted transition-colors hover:text-text">
                            Features
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/compare" class="text-text-muted transition-colors hover:text-text">
                            OSS vs Cloud
                        </RouterLink>
                    </li>
                </ul>
            </div>

            <div>
                <h4 class="text-xs font-semibold tracking-wider text-text-dim uppercase">
                    Resources
                </h4>
                <ul class="mt-4 space-y-2 text-sm">
                    <li>
                        <a
                            href="https://templatical.com"
                            target="_blank"
                            rel="noopener"
                            class="text-text-muted transition-colors hover:text-text"
                        >
                            Open-source SDK
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://play.templatical.com"
                            target="_blank"
                            rel="noopener"
                            class="text-text-muted transition-colors hover:text-text"
                        >
                            Playground
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://docs.templatical.com"
                            target="_blank"
                            rel="noopener"
                            class="text-text-muted transition-colors hover:text-text"
                        >
                            Docs
                        </a>
                    </li>
                    <li>
                        <RouterLink to="/faq" class="text-text-muted transition-colors hover:text-text">
                            FAQ
                        </RouterLink>
                    </li>
                </ul>
            </div>

            <div>
                <h4 class="text-xs font-semibold tracking-wider text-text-dim uppercase">
                    Contact
                </h4>
                <ul class="mt-4 space-y-2 text-sm">
                    <li>
                        <a
                            href="mailto:hello@templatical.com"
                            class="text-text-muted transition-colors hover:text-text"
                        >
                            hello@templatical.com
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://github.com/templatical/sdk"
                            target="_blank"
                            rel="noopener"
                            class="inline-flex items-center gap-1.5 text-text-muted transition-colors hover:text-text"
                        >
                            <Icon name="github" :size="14" />
                            GitHub
                        </a>
                    </li>
                </ul>
            </div>
        </div>
        <div
            class="border-t border-border px-6 py-6 text-center text-xs text-text-dim"
        >
            © {{ new Date().getFullYear() }} Templatical. Coming soon.
        </div>
    </footer>
</template>
