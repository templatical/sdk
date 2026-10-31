<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import FieldRow from "./FieldRow.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import NumberWithSuffix from "./NumberWithSuffix.vue";
import { useI18n } from "../../composables/useI18n";
import { inputClass } from "../../constants/styleConstants";
import type { CountdownBlock } from "@templatical/types";
import { computed } from "vue";
import { fontSelectValue } from "../../utils/withCurrentFont";

defineProps<{
  block: CountdownBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<CountdownBlock>): void;
}>();

const { t } = useI18n();

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const SEPARATORS = [
  { value: ":", label: ":" },
  { value: "-", label: "-" },
  { value: " ", label: "␣" },
];

type UnitKey = "Days" | "Hours" | "Minutes" | "Seconds";
const UNITS: UnitKey[] = ["Days", "Hours", "Minutes", "Seconds"];

const unitItems = computed(() =>
  UNITS.map((unit) => ({
    unit,
    showKey: `show${unit}` as const,
    labelKey: `label${unit}` as const,
    translationKey: unit.toLowerCase() as
      "days" | "hours" | "minutes" | "seconds",
  })),
);

function updateField(field: keyof CountdownBlock, value: unknown): void {
  emit("update", { [field]: value } as Partial<CountdownBlock>);
}
</script>

<template>
  <FieldRow path="targetDate" :label="t.countdown.targetDate">
    <input
      type="datetime-local"
      :class="inputClass"
      :value="block.targetDate"
      @input="
        updateField('targetDate', ($event.target as HTMLInputElement).value)
      "
    />
  </FieldRow>

  <FieldRow path="timezone" :label="t.countdown.timezone">
    <select
      :class="inputClass"
      :value="block.timezone"
      @change="
        updateField('timezone', ($event.target as HTMLSelectElement).value)
      "
    >
      <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
    </select>
  </FieldRow>

  <FieldRow :label="t.countdown.display">
    <div class="tpl:grid tpl:grid-cols-2 tpl:gap-2">
      <FieldRow
        v-for="item in unitItems"
        :key="item.unit"
        :path="item.showKey"
        :label="t.countdown[item.translationKey]"
        ><template #label-actions="{ controlId }"
          ><ToggleSwitch
            :control-id="controlId"
            hide-label
            class="tpl:text-[12px] tpl:text-[var(--tpl-text)]"
            :model-value="block[item.showKey]"
            :label="t.countdown[item.translationKey]"
            @update:model-value="updateField(item.showKey, $event)" /></template
      ></FieldRow>
    </div>
  </FieldRow>

  <FieldRow path="separator" :label="t.countdown.separator">
    <SlidingPillSelect
      :options="SEPARATORS"
      :model-value="block.separator"
      @update:model-value="updateField('separator', $event)"
    />
  </FieldRow>

  <FieldRow path="fontFamily" :label="t.countdown.fontFamily">
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
      <option value="">{{ t.countdown.inheritFont }}</option>
      <option
        v-for="font in fontFamilies"
        :key="font.value"
        :value="font.value"
      >
        {{ font.label }}
      </option>
    </select>
  </FieldRow>

  <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
    <FieldRow path="digitFontSize" :label="t.countdown.digitFontSize">
      <NumberWithSuffix
        :model-value="block.digitFontSize"
        :min="12"
        :max="72"
        suffix="px"
        @update:model-value="updateField('digitFontSize', $event)"
      />
    </FieldRow>
    <FieldRow path="labelFontSize" :label="t.countdown.labelFontSize">
      <NumberWithSuffix
        :model-value="block.labelFontSize"
        :min="8"
        :max="24"
        suffix="px"
        @update:model-value="updateField('labelFontSize', $event)"
      />
    </FieldRow>
  </div>

  <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
    <FieldRow path="digitColor" :label="t.countdown.digitColor">
      <ColorPicker
        :model-value="block.digitColor"
        @update:model-value="updateField('digitColor', $event)"
      />
    </FieldRow>
    <FieldRow path="labelColor" :label="t.countdown.labelColor">
      <ColorPicker
        :model-value="block.labelColor"
        @update:model-value="updateField('labelColor', $event)"
      />
    </FieldRow>
  </div>

  <FieldRow path="backgroundColor" :label="t.countdown.background">
    <ColorPicker
      :model-value="block.backgroundColor"
      @update:model-value="updateField('backgroundColor', $event)"
    />
  </FieldRow>

  <FieldRow :label="t.countdown.labels">
    <div class="tpl:grid tpl:grid-cols-2 tpl:gap-2">
      <FieldRow
        v-for="item in unitItems"
        :key="item.unit"
        :path="item.labelKey"
        :label="t.countdown[item.translationKey]"
        ><input
          type="text"
          :class="inputClass"
          :value="block[item.labelKey]"
          :placeholder="t.countdown[item.translationKey]"
          @input="
            updateField(
              item.labelKey,
              ($event.target as HTMLInputElement).value,
            )
          "
      /></FieldRow>
    </div>
  </FieldRow>

  <FieldRow path="expiredMessage" :label="t.countdown.expiry">
    <input
      type="text"
      :class="inputClass"
      :value="block.expiredMessage"
      :placeholder="t.countdown.expiredMessagePlaceholder"
      @input="
        updateField('expiredMessage', ($event.target as HTMLInputElement).value)
      "
    />
  </FieldRow>

  <FieldRow path="expiredImageUrl" :label="t.countdown.expiredImageUrl">
    <input
      type="url"
      :class="inputClass"
      :value="block.expiredImageUrl"
      placeholder="https://..."
      @input="
        updateField(
          'expiredImageUrl',
          ($event.target as HTMLInputElement).value,
        )
      "
    />
  </FieldRow>

  <FieldRow path="hideOnExpiry" :label="t.countdown.hideOnExpiry"
    ><template #label-actions="{ controlId }"
      ><ToggleSwitch
        :control-id="controlId"
        hide-label
        class="tpl:mb-3.5 tpl:text-[12px] tpl:text-[var(--tpl-text)]"
        :model-value="block.hideOnExpiry"
        :label="t.countdown.hideOnExpiry"
        @update:model-value="updateField('hideOnExpiry', $event)" /></template
  ></FieldRow>
</template>
