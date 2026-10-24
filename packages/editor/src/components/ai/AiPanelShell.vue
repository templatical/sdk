<script setup lang="ts">
import { Sparkles, X } from "@lucide/vue";

defineProps<{
  title: string;
  subtitle?: string;
  /** `ai-panel-chat`. */
  testid: string;
  closeLabel: string;
}>();

const emit = defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <div
    role="complementary"
    :aria-label="title"
    :data-testid="testid"
    class="tpl-ai-sidebar tpl:absolute tpl:top-14 tpl:right-0 tpl:bottom-0 tpl:flex tpl:w-[360px] tpl:flex-col tpl:border-l tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)]"
  >
    <!-- The header names the panel an AI feature (EU AI Act Art. 50). -->
    <div
      class="tpl:flex tpl:items-start tpl:justify-between tpl:gap-2 tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-3"
    >
      <div class="tpl:flex tpl:min-w-0 tpl:flex-col tpl:gap-0.5">
        <div
          class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-primary)]"
        >
          <Sparkles :size="13" :stroke-width="2" aria-hidden="true" />
          <span data-testid="ai-panel-title">{{ title }}</span>
        </div>
        <p
          v-if="subtitle"
          data-testid="ai-panel-subtitle"
          class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
        >
          {{ subtitle }}
        </p>
      </div>
      <div class="tpl:flex tpl:items-center tpl:gap-1">
        <slot name="actions" />
        <button
          type="button"
          data-testid="ai-panel-close"
          class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:text-[var(--tpl-text-muted)]"
          :aria-label="closeLabel"
          :title="closeLabel"
          @click="emit('close')"
        >
          <X :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="tpl:relative tpl:flex tpl:min-h-0 tpl:flex-1 tpl:flex-col">
      <slot />
    </div>
    <slot name="footer" />
  </div>
</template>
