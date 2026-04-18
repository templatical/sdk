<script setup lang="ts">
import { labelClass } from "../../../constants/styleConstants";
import { Lock } from "@lucide/vue";

defineProps<{
  label: string;
  required?: boolean;
  readOnly?: boolean;
}>();
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">
      {{ label }}
      <Lock
        v-if="readOnly"
        :size="12"
        class="tpl:inline tpl:text-[var(--tpl-text-dim)]"
      />
      <span v-if="required" class="tpl:text-[var(--tpl-danger)]">*</span>
    </label>
    <slot />
  </div>
</template>
