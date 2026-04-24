<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import type { MergeTagSegment } from "../composables/useMergeTagField";
import { X } from "@lucide/vue";

defineProps<{
  segments: MergeTagSegment[];
  displayClass: string;
  pulse?: boolean;
}>();

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "clear"): void;
}>();

const { t } = useI18n();

function onEdit(): void {
  emit("edit");
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="t.mergeTag.clickToEdit"
    :class="[displayClass, { 'tpl-pulse-fill': pulse }]"
    @click="onEdit"
    @keydown.enter="onEdit"
    @keydown.space.prevent="onEdit"
  >
    <template
      v-for="(seg, i) in segments"
      :key="`${seg.type}-${i}-${seg.value}`"
    >
      <span
        v-if="seg.type === 'mergeTag'"
        class="tpl-tooltip tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.9em] tpl:font-medium"
        :data-tooltip="seg.value"
        style="
          background-color: color-mix(
            in srgb,
            var(--tpl-primary) 20%,
            transparent
          );
          color: var(--tpl-primary);
        "
      >
        {{ seg.label }}
      </span>
      <span
        v-else-if="seg.type === 'logicMergeTag'"
        class="tpl-tooltip tpl:inline-flex tpl:items-center tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.8em] tpl:font-bold tpl:tracking-wide tpl:uppercase"
        :data-tooltip="seg.value"
        style="
          background-color: transparent;
          border: 1.5px solid
            color-mix(in srgb, var(--tpl-primary) 50%, transparent);
          color: var(--tpl-primary);
        "
      >
        {{ seg.keyword }}
      </span>
      <span v-else class="tpl:text-sm tpl:text-[var(--tpl-text)]">{{
        seg.value
      }}</span>
    </template>
    <button
      type="button"
      class="tpl:ml-auto tpl:flex tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text-dim)] tpl:opacity-60 tpl:transition-all hover:tpl:text-[var(--tpl-danger)] hover:tpl:opacity-100"
      :aria-label="t.mergeTag.remove"
      :title="t.mergeTag.remove"
      @click.stop="emit('clear')"
    >
      <X :size="12" :stroke-width="2.5" />
    </button>
  </div>
</template>
