<script lang="ts">
const seenTemplates = new Set<string>();
</script>
<script setup lang="ts">
import { ref, watch } from "vue";
import { X } from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";
import { secondaryBtnCompactClass } from "../../constants/styleConstants";
const props = defineProps<{ change: number; templateId?: string }>();
const { t } = useI18n();
const visible = ref(false);
let seenMount = false;
watch(
  () => props.templateId,
  () => {
    visible.value = false;
  },
);
watch(
  () => props.change,
  () => {
    if (props.templateId ? seenTemplates.has(props.templateId) : seenMount)
      return;
    if (props.templateId) seenTemplates.add(props.templateId);
    else seenMount = true;
    visible.value = true;
  },
);
</script>
<template>
  <div
    v-if="visible"
    data-testid="structure-notice"
    role="status"
    class="tpl:flex tpl:items-center tpl:gap-2 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-warning)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-1 tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
  >
    {{ t.localization.structureNotice }}
    <button
      type="button"
      :class="secondaryBtnCompactClass"
      :aria-label="t.localization.dismiss"
      @click="visible = false"
    >
      <X :size="14" />
    </button>
  </div>
</template>
