<script setup lang="ts">
import { Link, Unlink } from "@lucide/vue";

defineProps<{
  linked: boolean;
  /** Label while unlinked — what clicking will do. */
  linkLabel: string;
  /** Label while linked — what clicking will do. */
  unlinkLabel: string;
  testid?: string;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<template>
  <button
    type="button"
    class="tpl:flex tpl:h-7 tpl:w-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
    :class="
      linked
        ? 'tpl:border-[var(--tpl-primary)] tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary)]'
        : 'tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:hover:bg-[var(--tpl-bg-hover)]'
    "
    :aria-pressed="linked ? 'true' : 'false'"
    :aria-label="linked ? unlinkLabel : linkLabel"
    :title="linked ? unlinkLabel : linkLabel"
    :data-testid="testid"
    @click="emit('toggle')"
  >
    <Link v-if="linked" :size="14" :stroke-width="2" />
    <Unlink v-else :size="14" :stroke-width="2" />
  </button>
</template>
