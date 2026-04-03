<script setup lang="ts">
import type {
  CountdownBlock as CountdownBlockType,
  ViewportSize,
} from "@templatical/types";
import { useIntervalFn } from "@vueuse/core";
import { computed, ref } from "vue";
import { useI18n } from "../../composables/useI18n";

const props = defineProps<{
  block: CountdownBlockType;
  viewport: ViewportSize;
}>();

const { t } = useI18n();

const now = ref(Date.now());
useIntervalFn(() => {
  now.value = Date.now();
}, 1000);

const targetTime = computed(() => {
  if (!props.block.targetDate) return null;
  const date = new Date(props.block.targetDate);
  return isNaN(date.getTime()) ? null : date.getTime();
});

const isExpired = computed(() => {
  if (!targetTime.value) return false;
  return now.value >= targetTime.value;
});

const remaining = computed(() => {
  if (!targetTime.value || isExpired.value) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const diff = targetTime.value - now.value;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
});

const segments = computed(() => {
  const result: Array<{ value: string; label: string }> = [];
  if (props.block.showDays) {
    result.push({
      value: String(remaining.value.days).padStart(2, "0"),
      label: props.block.labelDays,
    });
  }
  if (props.block.showHours) {
    result.push({
      value: String(remaining.value.hours).padStart(2, "0"),
      label: props.block.labelHours,
    });
  }
  if (props.block.showMinutes) {
    result.push({
      value: String(remaining.value.minutes).padStart(2, "0"),
      label: props.block.labelMinutes,
    });
  }
  if (props.block.showSeconds) {
    result.push({
      value: String(remaining.value.seconds).padStart(2, "0"),
      label: props.block.labelSeconds,
    });
  }
  return result;
});

const containerStyle = computed(() => ({
  backgroundColor: props.block.backgroundColor,
  fontFamily: props.block.fontFamily || "inherit",
}));

const digitStyle = computed(() => ({
  fontSize: `${props.block.digitFontSize}px`,
  fontWeight: "bold" as const,
  color: props.block.digitColor,
  lineHeight: "1.2",
}));

const labelStyle = computed(() => ({
  fontSize: `${props.block.labelFontSize}px`,
  color: props.block.labelColor,
  marginTop: "4px",
}));

const separatorStyle = computed(() => ({
  fontSize: `${props.block.digitFontSize}px`,
  color: props.block.digitColor,
  fontFamily: props.block.fontFamily || "inherit",
}));
</script>

<template>
  <!-- Empty state: no target date -->
  <div
    v-if="!block.targetDate"
    class="tpl:flex tpl:items-center tpl:justify-center tpl:py-8 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
  >
    {{ t.countdown.setDate }}
  </div>

  <!-- Expired + hidden -->
  <div
    v-else-if="isExpired && block.hideOnExpiry"
    class="tpl:flex tpl:items-center tpl:justify-center tpl:py-4 tpl:text-xs tpl:text-[var(--tpl-text-dim)] tpl:opacity-50"
  >
    {{ t.countdown.hidden }}
  </div>

  <!-- Expired with message -->
  <div
    v-else-if="isExpired"
    :style="containerStyle"
    class="tpl:py-4 tpl:text-center"
  >
    <span
      :style="{
        fontSize: `${block.digitFontSize}px`,
        color: block.digitColor,
      }"
    >
      {{ block.expiredMessage }}
    </span>
  </div>

  <!-- Active countdown -->
  <div
    v-else
    :style="containerStyle"
    class="tpl:flex tpl:items-center tpl:justify-center tpl:gap-2 tpl:py-4"
  >
    <template v-for="(segment, index) in segments" :key="index">
      <span v-if="index > 0" :style="separatorStyle" class="tpl:self-start">
        {{ block.separator }}
      </span>
      <div class="tpl:text-center">
        <div :style="digitStyle">{{ segment.value }}</div>
        <div :style="labelStyle">{{ segment.label }}</div>
      </div>
    </template>
  </div>
</template>
