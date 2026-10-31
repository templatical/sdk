<script setup lang="ts">
import { computed, inject } from "vue";
import { CircleAlert, TriangleAlert } from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";
import { EDITOR_KEY, TEMPLATE_LINT_KEY } from "../../keys";

const props = defineProps<{ blockId: string }>();
const { t } = useI18n();
const lint = inject(TEMPLATE_LINT_KEY, null);
const editor = inject(EDITOR_KEY, null);

const blockIssues = computed(() =>
  (lint?.issues.value ?? []).filter(
    (i) =>
      i.blockId === props.blockId &&
      !(editor?.activeLocale?.value && i.ruleId.startsWith("localization.")),
  ),
);

const severity = computed<"error" | "warning" | null>(() => {
  if (blockIssues.value.some((i) => i.severity === "error")) return "error";
  if (blockIssues.value.some((i) => i.severity === "warning")) return "warning";
  return null;
});

const tooltip = computed(() =>
  severity.value === "error" ? t.issues.badgeError : t.issues.badgeWarning,
);
</script>

<template>
  <span
    v-if="severity"
    class="tpl-block-issue-badge tpl:flex tpl:size-5 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-[var(--tpl-bg)] tpl:shadow-[var(--tpl-shadow-sm)] tpl:ring-1 tpl:ring-[var(--tpl-border)]"
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
