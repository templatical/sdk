<script setup lang="ts">
/**
 * Switches the previews between the two merge-tag views: **Sample** (tags
 * replaced by their `MergeTag.sample`, rendered as ordinary text) and **Label**
 * (tags shown as their label with the usual cue).
 *
 * Deliberately the same segmented control as `ViewportToggle.vue` — the two sit
 * one click apart on the same preview surfaces, so they have to read as one
 * family rather than two similar things. Kept as a separate component rather
 * than generalising the viewport one: that would mean a generic segmented
 * control with an icon map, and two call sites don't justify the indirection.
 *
 * Renders only where a preview is showing. It must never appear over the
 * editing canvas, because substitution never happens there.
 *
 * **Renders nothing at all unless some configured tag declares a `sample`.**
 * With none, the two views are identical, so the control would be inert. The
 * check lives here rather than at each call site so the guarantee holds for
 * every surface — present and future — without three `v-if`s to keep in step.
 */
import { hasMergeTagSamples } from "@templatical/types";
import { useI18n } from "../composables/useI18n";
import { MERGE_TAGS_KEY } from "../keys";
import { TextCursorInput, Sparkles } from "@lucide/vue";
import { computed, inject } from "vue";

const props = defineProps<{
  /** `true` for Sample view, `false` for Label view. */
  sampleMode: boolean;
}>();

const emit = defineEmits<{
  (e: "change", sampleMode: boolean): void;
}>();

const { t } = useI18n();

const mergeTags = inject(MERGE_TAGS_KEY, []);
const isAvailable = computed(() => hasMergeTagSamples(mergeTags));

const modes = computed(() => [
  { value: true, label: t.mergeTagPreview.sample },
  { value: false, label: t.mergeTagPreview.labelView },
]);

const pillOffset = computed(() => {
  const index = modes.value.findIndex((m) => m.value === props.sampleMode);
  return `translateX(${index * 100}%)`;
});
</script>

<template>
  <div
    v-if="isAvailable"
    role="radiogroup"
    :aria-label="t.mergeTagPreview.label"
    data-testid="merge-tag-mode-toggle"
    class="tpl:relative tpl:grid tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1"
    :style="{
      gridTemplateColumns: `repeat(${modes.length}, 1fr)`,
      backgroundColor: 'var(--tpl-bg-hover)',
    }"
  >
    <!-- Sliding pill -->
    <div
      class="tpl:absolute tpl:inset-y-1 tpl:rounded-[var(--tpl-radius-sm)]"
      :style="{
        left: '4px',
        width: `calc((100% - 8px) / ${modes.length})`,
        transform: pillOffset,
        backgroundColor: 'var(--tpl-bg)',
        boxShadow: 'var(--tpl-shadow)',
        transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
      }"
    ></div>

    <button
      v-for="mode in modes"
      :key="String(mode.value)"
      role="radio"
      :aria-checked="sampleMode === mode.value"
      :aria-label="mode.label"
      class="tpl:relative tpl:z-10 tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium"
      :style="{
        color:
          sampleMode === mode.value
            ? 'var(--tpl-primary)'
            : 'var(--tpl-text-muted)',
        transition: 'color 120ms cubic-bezier(0.16, 1, 0.3, 1)',
      }"
      :title="mode.label"
      @click="emit('change', mode.value)"
    >
      <Sparkles v-if="mode.value" :size="18" :stroke-width="1.5" />
      <TextCursorInput v-else :size="18" :stroke-width="1.5" />
      <span>{{ mode.label }}</span>
    </button>
  </div>
</template>
