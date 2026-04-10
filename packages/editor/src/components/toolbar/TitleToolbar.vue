<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import { inputClass, labelClass } from "../../constants/styleConstants";
import type { TitleBlock } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight } from "@lucide/vue";

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
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.title.level }}</label>
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
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.title.fontFamily }}</label>
    <select
      :class="inputClass"
      :value="block.fontFamily || ''"
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
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.title.color }}</label>
    <ColorPicker
      :model-value="block.color"
      @update:model-value="updateField('color', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.title.align }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft, icon: AlignLeft },
        { value: 'center', label: t.title.alignCenter, icon: AlignCenter },
        { value: 'right', label: t.title.alignRight, icon: AlignRight },
      ]"
      :model-value="block.textAlign"
      @update:model-value="updateField('textAlign', $event)"
    />
  </div>
</template>
