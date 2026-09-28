<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
import { format, usePlaygroundI18n } from "@/i18n";

defineProps<{
  code: string;
  /** Set when the scene offers a value to pick, such as the i18n locale. */
  value?: string;
  options?: { value: string; label: string }[];
}>();

const emit = defineEmits<{ pick: [value: string] }>();

const { t } = usePlaygroundI18n();

function onChange(event: Event): void {
  emit("pick", (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <!-- A transparent native select over the chip: the menu, the keyboard and
       screen readers are the platform's own. -->
  <label
    v-if="value !== undefined"
    data-testid="scene-init-key"
    class="pg-init-picker"
  >
    <code class="font-mono">{{ code }}: "{{ value }}"</code>
    <ChevronDown :size="12" :stroke-width="2" aria-hidden="true" />
    <select
      data-testid="scene-value-picker"
      class="pg-init-picker-select"
      :value="value"
      :aria-label="format(t.host.pickValue, { key: code })"
      @change="onChange"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
  <code
    v-else
    data-testid="scene-init-key"
    class="shrink-0 font-mono text-xs text-gray-600 dark:text-gray-400"
    >{{ code }}</code
  >
</template>
