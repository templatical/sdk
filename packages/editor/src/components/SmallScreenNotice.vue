<script setup lang="ts">
import { Monitor } from "@lucide/vue";
import { useI18n } from "../composables/useI18n";

// Full-cover gate shown below the usable-width breakpoint (issue #235).
// Rendered as the last child of `.tpl` and given a literal z-index above all
// chrome (header z-50, sidebars z-40) AND `.tpl-popover-root` (z 10000), so the
// opaque overlay covers everything including any open popover/modal.
//
// The z-index is a LITERAL rather than a token or a Tailwind utility, for two
// separate reasons: a `var()` token would live on `:root`, unreachable from
// inside the shadow root; and this notice must outrank `.tpl-popover-root`
// (10000), which is itself a literal. Named z layers no longer exist — Tailwind
// derives z utilities from `--z-index-*`, so a named one emits nothing (guarded
// in `tests/design-system-conformance.test.ts`). Deliberately NOT written as a
// class-like name in prose: that guard scans source text and cannot tell a
// comment from a class attribute.
const { t } = useI18n();
</script>

<template>
  <div
    class="tpl-small-screen-notice tpl:absolute tpl:inset-0 tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-4 tpl:px-6 tpl:py-10 tpl:text-center tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)]"
    style="z-index: 10001"
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
