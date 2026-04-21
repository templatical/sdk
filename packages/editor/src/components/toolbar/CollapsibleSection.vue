<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";

defineProps<{
  title: string;
  open: boolean;
  noBorder?: boolean;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<template>
  <div
    class="tpl:py-3"
    :class="noBorder ? '' : 'tpl:border-t tpl:border-[var(--tpl-border)]'"
  >
    <button
      type="button"
      class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
      @click="$emit('toggle')"
    >
      <ChevronDown
        class="tpl:transition-transform tpl:duration-200"
        :class="open ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
        :size="12"
        :stroke-width="2"
      />
      <span>{{ title }}</span>
    </button>
    <div v-show="open" class="tpl:mt-3">
      <slot />
    </div>
  </div>
</template>
