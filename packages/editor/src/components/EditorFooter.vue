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
    class="tpl:pointer-events-none tpl:absolute tpl:bottom-0 tpl:z-50 tpl:flex tpl:h-8 tpl:items-center tpl:justify-end tpl:pr-4 tpl:text-[9px] tpl:opacity-90 tpl:transition-all tpl:duration-300 tpl:text-[var(--tpl-text-dim)]"
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
        class="tpl:inline-flex tpl:items-center tpl:gap-1 tpl:font-medium tpl:transition-colors tpl:duration-150 hover:tpl:opacity-80 tpl:text-[var(--tpl-text-muted)]"
        style="text-decoration: none"
      >
        <img
          width="14"
          height="14"
          src="https://templatical.com/logo.svg"
          alt=""
        />
        Templatical
      </a>
      <span class="tpl:text-[var(--tpl-border)]">·</span>
      <a
        href="https://github.com/templatical/sdk"
        target="_blank"
        rel="noopener noreferrer"
        class="tpl:transition-colors tpl:duration-150 hover:tpl:opacity-80 tpl:text-[var(--tpl-text-dim)]"
        style="text-decoration: none"
      >
        {{ t.footer.openSource }}
      </a>
    </div>
  </footer>
</template>
