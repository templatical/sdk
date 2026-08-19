<script setup lang="ts">
import { computed, ref } from "vue";
import { useIntervalFn } from "@vueuse/core";
import { useI18n } from "../composables/useI18n";
import { formatRelativeTime } from "../utils/formatRelativeTime";

const props = defineProps<{
  /** ISO 8601 timestamp, straight from the store. */
  iso: string;
  /** Which field it came from — decides the "Updated"/"Created" wording. */
  kind: "updatedAt" | "createdAt";
}>();

const { t, format } = useI18n();

// The header stays open for as long as the session does, so a label computed
// once would sit at "Just now" for hours. A minute is the formatter's smallest
// bucket, so nothing finer would show anyway.
const tick = ref(0);
useIntervalFn(() => {
  tick.value += 1;
}, 60000);

const label = computed(() => {
  // Depended on for its side effect: `formatRelativeTime` reads the clock
  // itself, so the tick is the only thing that can invalidate this.
  void tick.value;
  const relative = formatRelativeTime(props.iso, t.time, format);
  // Null covers a value that does not parse and one further into the future
  // than clock skew explains. Falling back to an absolute date would put a
  // number where the eye expects chrome, so the line is dropped instead.
  if (relative === null) return "";
  // The shared buckets are phrased to stand alone, so the smallest one is
  // capitalised ("Just now") and reads wrong inside "Updated {time}". Matched
  // against the label rather than re-deriving a one-minute threshold, so what
  // counts as "just now" stays `formatRelativeTime`'s decision alone.
  const isJustNow = relative === t.time.justNow;
  if (props.kind === "updatedAt") {
    return isJustNow
      ? t.header.updatedJustNow
      : format(t.header.updatedAt, { time: relative });
  }
  return isJustNow
    ? t.header.createdJustNow
    : format(t.header.createdAt, { time: relative });
});

/** Full date for the tooltip — locale-formatted, so it needs no i18n keys. */
const absolute = computed(() => {
  const parsed = new Date(props.iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
});
</script>

<template>
  <!-- `px-2` aligns the line under the name field's text, which carries the same
       padding for its hover affordance. Present whether or not the name renders,
       so the left column reads the same in both. -->
  <span
    v-if="label"
    data-testid="template-timestamp"
    :title="absolute"
    class="tpl:max-w-[260px] tpl:truncate tpl:px-2 tpl:text-xs tpl:leading-tight tpl:text-[var(--tpl-text-dim)]"
  >
    {{ label }}
  </span>
</template>
