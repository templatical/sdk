<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useMergeTag } from "../composables/useMergeTag";
import type { MergeTagSegment } from "../composables/useMergeTagField";
import { Pencil, X } from "@lucide/vue";

defineProps<{
  segments: MergeTagSegment[];
  displayClass: string;
  pulse?: boolean;
}>();

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "clear"): void;
  /** Index into `segments` of the merge tag the user wants to swap. */
  (e: "repick", index: number): void;
}>();

const { t, format } = useI18n();
const { canRepickMergeTag, showRawValue } = useMergeTag();

function onEdit(): void {
  emit("edit");
}
</script>

<template>
  <!--
    role="group", never role="button" — the field holds its own controls (a
    button per merge tag, Edit, Clear), and a button may not contain focusable
    descendants: it announces as a control inside a control and the tab order
    reads as if you stepped into the element you just landed on. The click
    handler here is a redundant mouse convenience over the Edit button, which
    is the real, keyboard-reachable control.
  -->
  <div
    role="group"
    :aria-label="t.mergeTag.fieldGroup"
    :class="[displayClass, { 'tpl-pulse-fill': pulse }]"
    @click="onEdit"
  >
    <template
      v-for="(seg, i) in segments"
      :key="`${seg.type}-${i}-${seg.value}`"
    >
      <button
        v-if="seg.type === 'mergeTag' && canRepickMergeTag(seg.value)"
        type="button"
        :class="[
          'tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:rounded tpl:border-none tpl:px-1.5 tpl:py-0.5 tpl:text-[0.9em] tpl:font-medium',
          showRawValue ? 'tpl-tooltip' : '',
        ]"
        :data-tooltip="showRawValue ? seg.value : undefined"
        :aria-label="format(t.mergeTag.changeTag, { label: seg.label })"
        data-testid="merge-tag-field-chip"
        style="
          background-color: color-mix(
            in srgb,
            var(--tpl-primary) 20%,
            transparent
          );
          color: var(--tpl-primary);
        "
        @click.stop="emit('repick', i)"
      >
        {{ seg.label }}
      </button>
      <!--
        No chooser can resolve this token, so it stays a plain span and the
        click falls through to the wrapper, which opens the raw editor — the
        only way left to repair it. A disabled button would swallow the click
        instead. Keyboard users reach the same editor through the Edit button.
      -->
      <span
        v-else-if="seg.type === 'mergeTag'"
        :class="[
          'tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.9em] tpl:font-medium',
          showRawValue ? 'tpl-tooltip' : '',
        ]"
        :data-tooltip="showRawValue ? seg.value : undefined"
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
      class="tpl:ml-auto tpl:flex tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text-dim)] tpl:opacity-60 tpl:transition-all tpl:hover:text-[var(--tpl-primary)] tpl:hover:opacity-100"
      :aria-label="t.mergeTag.editAsText"
      :title="t.mergeTag.editAsText"
      data-testid="merge-tag-field-edit"
      @click.stop="onEdit"
    >
      <Pencil :size="12" :stroke-width="2" />
    </button>
    <button
      type="button"
      class="tpl:flex tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text-dim)] tpl:opacity-60 tpl:transition-all tpl:hover:text-[var(--tpl-danger)] tpl:hover:opacity-100"
      :aria-label="t.mergeTag.remove"
      :title="t.mergeTag.remove"
      data-testid="merge-tag-field-clear"
      @click.stop="emit('clear')"
    >
      <X :size="12" :stroke-width="2.5" />
    </button>
  </div>
</template>
