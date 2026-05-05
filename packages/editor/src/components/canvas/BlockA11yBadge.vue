<script setup lang="ts">
import { computed, inject } from "vue";
import { CircleAlert, TriangleAlert } from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";
import { ACCESSIBILITY_LINT_KEY } from "../../keys";

const props = defineProps<{ blockId: string }>();
const { t } = useI18n();
const lint = inject(ACCESSIBILITY_LINT_KEY, null);

const blockIssues = computed(() =>
  (lint?.issues.value ?? []).filter((i) => i.blockId === props.blockId),
);

const severity = computed<"error" | "warning" | null>(() => {
  if (blockIssues.value.some((i) => i.severity === "error")) return "error";
  if (blockIssues.value.some((i) => i.severity === "warning")) return "warning";
  return null;
});

const tooltip = computed(() =>
  severity.value === "error"
    ? t.accessibility.badgeError
    : t.accessibility.badgeWarning,
);
</script>

<template>
  <span
    v-if="severity"
    class="tpl:absolute tpl:top-1 tpl:right-1 tpl:z-10 tpl:flex tpl:size-5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-[var(--tpl-bg)] tpl:shadow-[var(--tpl-shadow-sm)] tpl:ring-1 tpl:ring-[var(--tpl-border)]"
    :class="
      severity === 'error'
        ? 'tpl:text-[var(--tpl-danger)]'
        : 'tpl:text-[var(--tpl-warning)]'
    "
    :title="tooltip"
    :aria-label="tooltip"
    role="img"
  >
    <CircleAlert
      v-if="severity === 'error'"
      :size="14"
      :stroke-width="2.25"
      fill="currentColor"
      stroke="var(--tpl-bg)"
    />
    <TriangleAlert
      v-else
      :size="14"
      :stroke-width="2.25"
      fill="currentColor"
      stroke="var(--tpl-bg)"
    />
  </span>
</template>
