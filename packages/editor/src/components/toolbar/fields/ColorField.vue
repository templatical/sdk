<script setup lang="ts">
import { computed, inject } from "vue";
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockColorField } from "@templatical/types";
import FieldWrapper from "./FieldWrapper.vue";
import ColorPicker from "../../ColorPicker.vue";
import { COLORS_KEY } from "../../../keys";
import { DEFAULT_RESOLVED_COLORS } from "../../../utils/resolveColorsConfig";
import { resolveFieldColors } from "../../../utils/resolveFieldColors";

const props = defineProps<{
  field: CustomBlockColorField;
  modelValue: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();

// Narrow the injected editor-wide palette by this field's own `presets` /
// `allowCustom`. Presentational only: the field config is audited once per
// block definition at registration time (`useEditorCore` →
// `collectColorFieldIssues`), never here — this component mounts again on every
// block selection and once per repeater item, so warning from here would repeat
// the same message indefinitely.
const editorColors = inject(COLORS_KEY, DEFAULT_RESOLVED_COLORS);
const colors = computed(() => resolveFieldColors(props.field, editorColors));
</script>

<template>
  <FieldWrapper
    :label="field.label"
    :required="field.required"
    :read-only="readOnly"
  >
    <ColorPicker
      :model-value="modelValue"
      :placeholder="field.placeholder"
      :disabled="readOnly"
      :presets="colors.presets"
      :allow-custom="colors.allowCustom"
      :title="readOnly ? t.customBlocks.dataSource.readOnlyTooltip : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </FieldWrapper>
</template>
