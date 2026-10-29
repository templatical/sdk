<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import { inputClass } from "../../constants/styleConstants";
import type { TitleBlock } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight } from "@lucide/vue";
import { fontSelectValue } from "../../utils/withCurrentFont";

defineProps<{
  block: TitleBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<TitleBlock>): void;
}>();

const { t } = useI18n();

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<TitleBlock>);
}
</script>

<template>
  <FieldRow :label="t.title.level" class="tpl:mb-3.5" path="level">
    <select
      :class="inputClass"
      :value="block.level"
      @change="
        updateField('level', Number(($event.target as HTMLSelectElement).value))
      "
    >
      <option :value="1">{{ t.title.heading1 }}</option>
      <option :value="2">{{ t.title.heading2 }}</option>
      <option :value="3">{{ t.title.heading3 }}</option>
      <option :value="4">{{ t.title.heading4 }}</option>
    </select>
  </FieldRow>
  <FieldRow :label="t.title.fontFamily" class="tpl:mb-3.5" path="fontFamily">
    <select
      :class="inputClass"
      :value="fontSelectValue(block.fontFamily)"
      @change="
        updateField(
          'fontFamily',
          ($event.target as HTMLSelectElement).value || undefined,
        )
      "
    >
      <option value="">{{ t.title.inheritFont }}</option>
      <option
        v-for="font in fontFamilies"
        :key="font.value"
        :value="font.value"
      >
        {{ font.label }}
      </option>
    </select>
  </FieldRow>
  <FieldRow :label="t.title.color" class="tpl:mb-3.5" path="color">
    <ColorPicker
      :model-value="block.color ?? ''"
      @update:model-value="updateField('color', $event || undefined)"
    />
  </FieldRow>
  <FieldRow :label="t.title.align" class="tpl:mb-3.5" path="textAlign">
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft, icon: AlignLeft },
        { value: 'center', label: t.title.alignCenter, icon: AlignCenter },
        { value: 'right', label: t.title.alignRight, icon: AlignRight },
      ]"
      :model-value="block.textAlign"
      @update:model-value="updateField('textAlign', $event)"
    />
  </FieldRow>
</template>
