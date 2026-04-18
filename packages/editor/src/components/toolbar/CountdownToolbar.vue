<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import type { CountdownBlock } from "@templatical/types";

defineProps<{
  block: CountdownBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<CountdownBlock>): void;
}>();

const { t } = useI18n();

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<CountdownBlock>);
}
</script>

<template>
  <!-- Target Date -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.targetDate }}</label>
    <input
      type="datetime-local"
      :class="inputClass"
      :value="block.targetDate"
      @input="
        updateField('targetDate', ($event.target as HTMLInputElement).value)
      "
    />
  </div>

  <!-- Timezone -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.timezone }}</label>
    <select
      :class="inputClass"
      :value="block.timezone"
      @change="
        updateField('timezone', ($event.target as HTMLSelectElement).value)
      "
    >
      <option value="UTC">UTC</option>
      <option value="America/New_York">America/New_York</option>
      <option value="America/Chicago">America/Chicago</option>
      <option value="America/Denver">America/Denver</option>
      <option value="America/Los_Angeles">America/Los_Angeles</option>
      <option value="Europe/London">Europe/London</option>
      <option value="Europe/Berlin">Europe/Berlin</option>
      <option value="Europe/Paris">Europe/Paris</option>
      <option value="Europe/Moscow">Europe/Moscow</option>
      <option value="Asia/Dubai">Asia/Dubai</option>
      <option value="Asia/Kolkata">Asia/Kolkata</option>
      <option value="Asia/Shanghai">Asia/Shanghai</option>
      <option value="Asia/Tokyo">Asia/Tokyo</option>
      <option value="Australia/Sydney">Australia/Sydney</option>
      <option value="Pacific/Auckland">Pacific/Auckland</option>
    </select>
  </div>

  <!-- Display Toggles -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.display }}</label>
    <div class="tpl:grid tpl:grid-cols-2 tpl:gap-2">
      <label
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text)]"
      >
        <input
          type="checkbox"
          class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
          :checked="block.showDays"
          @change="
            updateField('showDays', ($event.target as HTMLInputElement).checked)
          "
        />
        {{ t.countdown.days }}
      </label>
      <label
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text)]"
      >
        <input
          type="checkbox"
          class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
          :checked="block.showHours"
          @change="
            updateField(
              'showHours',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        {{ t.countdown.hours }}
      </label>
      <label
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text)]"
      >
        <input
          type="checkbox"
          class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
          :checked="block.showMinutes"
          @change="
            updateField(
              'showMinutes',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        {{ t.countdown.minutes }}
      </label>
      <label
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text)]"
      >
        <input
          type="checkbox"
          class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
          :checked="block.showSeconds"
          @change="
            updateField(
              'showSeconds',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        {{ t.countdown.seconds }}
      </label>
    </div>
  </div>

  <!-- Separator -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.separator }}</label>
    <SlidingPillSelect
      :options="[
        { value: ':', label: ':' },
        { value: '-', label: '-' },
        { value: ' ', label: '␣' },
      ]"
      :model-value="block.separator"
      @update:model-value="updateField('separator', $event)"
    />
  </div>

  <!-- Font Family -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.fontFamily }}</label>
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
      <option value="">{{ t.countdown.inheritFont }}</option>
      <option
        v-for="font in fontFamilies"
        :key="font.value"
        :value="font.value"
      >
        {{ font.label }}
      </option>
    </select>
  </div>

  <!-- Digit Size / Label Size -->
  <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
    <div class="tpl:mb-3.5">
      <label :class="labelClass">{{ t.countdown.digitFontSize }}</label>
      <div class="tpl:flex tpl:items-stretch">
        <input
          type="number"
          :class="inputGroupInputClass"
          :value="block.digitFontSize"
          min="12"
          max="72"
          @input="
            updateField(
              'digitFontSize',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
        <span :class="inputSuffixClass">px</span>
      </div>
    </div>
    <div class="tpl:mb-3.5">
      <label :class="labelClass">{{ t.countdown.labelFontSize }}</label>
      <div class="tpl:flex tpl:items-stretch">
        <input
          type="number"
          :class="inputGroupInputClass"
          :value="block.labelFontSize"
          min="8"
          max="24"
          @input="
            updateField(
              'labelFontSize',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
        <span :class="inputSuffixClass">px</span>
      </div>
    </div>
  </div>

  <!-- Digit Color / Label Color -->
  <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
    <div class="tpl:mb-3.5">
      <label :class="labelClass">{{ t.countdown.digitColor }}</label>
      <ColorPicker
        :model-value="block.digitColor"
        @update:model-value="updateField('digitColor', $event)"
      />
    </div>
    <div class="tpl:mb-3.5">
      <label :class="labelClass">{{ t.countdown.labelColor }}</label>
      <ColorPicker
        :model-value="block.labelColor"
        @update:model-value="updateField('labelColor', $event)"
      />
    </div>
  </div>

  <!-- Background -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.background }}</label>
    <ColorPicker
      :model-value="block.backgroundColor"
      @update:model-value="updateField('backgroundColor', $event)"
    />
  </div>

  <!-- Labels -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.labels }}</label>
    <div class="tpl:grid tpl:grid-cols-2 tpl:gap-2">
      <input
        type="text"
        :class="inputClass"
        :value="block.labelDays"
        :placeholder="t.countdown.days"
        @input="
          updateField('labelDays', ($event.target as HTMLInputElement).value)
        "
      />
      <input
        type="text"
        :class="inputClass"
        :value="block.labelHours"
        :placeholder="t.countdown.hours"
        @input="
          updateField('labelHours', ($event.target as HTMLInputElement).value)
        "
      />
      <input
        type="text"
        :class="inputClass"
        :value="block.labelMinutes"
        :placeholder="t.countdown.minutes"
        @input="
          updateField('labelMinutes', ($event.target as HTMLInputElement).value)
        "
      />
      <input
        type="text"
        :class="inputClass"
        :value="block.labelSeconds"
        :placeholder="t.countdown.seconds"
        @input="
          updateField('labelSeconds', ($event.target as HTMLInputElement).value)
        "
      />
    </div>
  </div>

  <!-- Expiry -->
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.expiry }}</label>
    <input
      type="text"
      :class="inputClass"
      :value="block.expiredMessage"
      :placeholder="t.countdown.expiredMessagePlaceholder"
      @input="
        updateField('expiredMessage', ($event.target as HTMLInputElement).value)
      "
    />
  </div>

  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.countdown.expiredImageUrl }}</label>
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
  </div>

  <label
    class="tpl:mb-3.5 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text)]"
  >
    <input
      type="checkbox"
      class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
      :checked="block.hideOnExpiry"
      @change="
        updateField('hideOnExpiry', ($event.target as HTMLInputElement).checked)
      "
    />
    {{ t.countdown.hideOnExpiry }}
  </label>
</template>
