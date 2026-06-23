<script setup lang="ts">
import { Monitor } from "@lucide/vue";
import { useI18n } from "../composables/useI18n";

// Full-cover gate shown below the usable-width breakpoint (issue #235).
// Layering: the `tpl:z-modal` utility resolves to a literal 10000 (Tailwind
// inlines `@theme inline` z-tokens, so it works inside the shadow root — unlike
// a raw `var(--z-modal)`). Both editors render this as the last child of `.tpl`
// so the tie with `.tpl-popover-root` (also z 10000) breaks in its favour,
// covering all chrome and any open popovers/modals.
const { t } = useI18n();
</script>

<template>
  <div
    class="tpl-small-screen-notice tpl:absolute tpl:inset-0 tpl:z-modal tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-4 tpl:px-6 tpl:py-10 tpl:text-center tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)]"
    role="status"
    data-testid="small-screen-notice"
  >
    <div class="tpl:text-[var(--tpl-text-dim)]">
      <Monitor :size="48" :stroke-width="1.5" />
    </div>
    <h2
      class="tpl:m-0 tpl:text-base tpl:font-semibold tpl:text-[var(--tpl-text)]"
    >
      {{ t.smallScreen.title }}
    </h2>
    <p class="tpl:m-0 tpl:max-w-sm tpl:text-sm tpl:leading-normal">
      {{ t.smallScreen.message }}
    </p>
  </div>
</template>
