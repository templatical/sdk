<script setup lang="ts">
import { useI18n } from "../composables/useI18n";

defineProps<{
  /** Positioning classes for the footer (left/right offsets). */
  positionClass?: string | string[];
}>();

const { t } = useI18n();
</script>

<template>
  <footer
    class="tpl:pointer-events-none tpl:absolute tpl:bottom-0 tpl:z-50 tpl:flex tpl:h-8 tpl:items-center tpl:justify-end tpl:pr-4 tpl:text-[10px] tpl:opacity-90 tpl:transition-all tpl:duration-300 tpl:text-[var(--tpl-text-dim)]"
    :class="positionClass"
  >
    <div
      class="tpl:pointer-events-auto tpl:flex tpl:items-center tpl:gap-1.5 tpl:rounded-tl-lg tpl:p-1"
      style="
        background-color: color-mix(
          in srgb,
          var(--tpl-canvas-bg) 85%,
          transparent
        );
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      "
    >
      <span>{{ t.footer.poweredBy }}</span>
      <a
        href="https://templatical.com"
        target="_blank"
        rel="noopener noreferrer"
        class="tpl:inline-flex tpl:items-center tpl:gap-1 tpl:font-medium tpl:transition-colors tpl:hover:opacity-80 tpl:text-[var(--tpl-text-muted)]"
        style="text-decoration: none"
      >
        <!-- An inline mark, not an image loaded from templatical.com: the docs promise init() makes no requests to Templatical, and editorFooter.test.ts holds that. -->
        <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden="true">
          <rect
            x="10"
            y="1"
            width="18"
            height="22"
            rx="3"
            fill="oklch(85% 0.08 55)"
            transform="rotate(8 19 12)"
          />
          <rect
            x="6"
            y="2"
            width="18"
            height="22"
            rx="3"
            fill="oklch(77% 0.12 55)"
            transform="rotate(-4 15 13)"
          />
          <rect
            x="2"
            y="4"
            width="18"
            height="22"
            rx="3"
            fill="oklch(70% 0.16 55)"
          />
          <rect
            x="6"
            y="9"
            width="10"
            height="1.8"
            rx="0.9"
            fill="white"
            opacity="0.9"
          />
          <rect
            x="6"
            y="13.5"
            width="7"
            height="1.5"
            rx="0.75"
            fill="white"
            opacity="0.6"
          />
          <rect
            x="6"
            y="17"
            width="9"
            height="1.5"
            rx="0.75"
            fill="white"
            opacity="0.6"
          />
          <rect
            x="6"
            y="20.5"
            width="5"
            height="1.5"
            rx="0.75"
            fill="white"
            opacity="0.4"
          />
        </svg>
        Templatical
      </a>
    </div>
  </footer>
</template>
