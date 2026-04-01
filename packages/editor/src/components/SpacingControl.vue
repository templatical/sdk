<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { Lock, LockOpen, Minus, Plus } from "lucide-vue-next";
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: SpacingValue;
  label: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: SpacingValue): void;
}>();

const { t } = useI18n();

interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const locked = ref(
  props.modelValue.top === props.modelValue.right &&
    props.modelValue.right === props.modelValue.bottom &&
    props.modelValue.bottom === props.modelValue.left,
);

watch(
  () => props.modelValue,
  (newValue) => {
    if (locked.value) {
      const allSame =
        newValue.top === newValue.right &&
        newValue.right === newValue.bottom &&
        newValue.bottom === newValue.left;
      if (!allSame) {
        locked.value = false;
      }
    }
  },
  { deep: true },
);

function updateValue(direction: keyof SpacingValue, delta: number): void {
  const currentValue = props.modelValue[direction];
  const newValue = Math.max(0, currentValue + delta);

  if (locked.value) {
    emit("update:modelValue", {
      top: newValue,
      right: newValue,
      bottom: newValue,
      left: newValue,
    });
  } else {
    emit("update:modelValue", {
      ...props.modelValue,
      [direction]: newValue,
    });
  }
}

function setDirectValue(direction: keyof SpacingValue, value: number): void {
  const newValue = Math.max(0, value);

  if (locked.value) {
    emit("update:modelValue", {
      top: newValue,
      right: newValue,
      bottom: newValue,
      left: newValue,
    });
  } else {
    emit("update:modelValue", {
      ...props.modelValue,
      [direction]: newValue,
    });
  }
}

function toggleLock(): void {
  locked.value = !locked.value;
  if (locked.value) {
    const value = props.modelValue.top;
    emit("update:modelValue", {
      top: value,
      right: value,
      bottom: value,
      left: value,
    });
  }
}

const stepperBtnClass =
  "tpl:flex tpl:items-center tpl:justify-center tpl:w-8 tpl:h-8 tpl:text-[var(--tpl-text-muted)] tpl:bg-[var(--tpl-bg)] tpl:border tpl:border-[var(--tpl-border)] tpl:cursor-pointer tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:bg-[var(--tpl-bg-hover)] hover:tpl:text-[var(--tpl-text)] active:tpl:bg-[var(--tpl-bg-active)]";
const inputClass =
  "tpl:w-10 tpl:h-8 tpl:text-center tpl:text-xs tpl:font-medium tpl:border-y tpl:border-x-0 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)] tpl:outline-none tpl:transition-all tpl:duration-[120ms] focus:tpl:border-[var(--tpl-primary)] focus:tpl:shadow-[var(--tpl-ring)]";
</script>

<template>
  <div class="spacing-control">
    <label
      class="tpl:mb-2 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
    >
      {{ label }}
    </label>

    <div class="tpl:flex tpl:flex-col tpl:items-center tpl:gap-1.5">
      <!-- Top -->
      <div class="tpl:flex tpl:items-center">
        <button
          :aria-label="t.spacingControl.decreaseTop"
          :class="[stepperBtnClass, 'tpl:rounded-l-[var(--tpl-radius-sm)]']"
          @click="updateValue('top', -1)"
        >
          <Minus :size="12" :stroke-width="2" />
        </button>
        <input
          type="number"
          :class="inputClass"
          :value="modelValue.top"
          min="0"
          @input="
            setDirectValue(
              'top',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
        <button
          :aria-label="t.spacingControl.increaseTop"
          :class="[stepperBtnClass, 'tpl:rounded-r-[var(--tpl-radius-sm)]']"
          @click="updateValue('top', 1)"
        >
          <Plus :size="12" :stroke-width="2" />
        </button>
      </div>

      <!-- Middle row: Left - Lock - Right -->
      <div class="tpl:flex tpl:items-center tpl:gap-2">
        <!-- Left -->
        <div class="tpl:flex tpl:items-center">
          <button
            :aria-label="t.spacingControl.decreaseLeft"
            :class="[stepperBtnClass, 'tpl:rounded-l-[var(--tpl-radius-sm)]']"
            @click="updateValue('left', -1)"
          >
            <Minus :size="12" :stroke-width="2" />
          </button>
          <input
            type="number"
            :class="inputClass"
            :value="modelValue.left"
            min="0"
            @input="
              setDirectValue(
                'left',
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
          <button
            :aria-label="t.spacingControl.increaseLeft"
            :class="[stepperBtnClass, 'tpl:rounded-r-[var(--tpl-radius-sm)]']"
            @click="updateValue('left', 1)"
          >
            <Plus :size="12" :stroke-width="2" />
          </button>
        </div>

        <!-- Lock button -->
        <button
          class="tpl:flex tpl:h-8 tpl:w-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
          :class="
            locked
              ? 'tpl:border-[var(--tpl-primary)] tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary)]'
              : 'tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] hover:tpl:bg-[var(--tpl-bg-hover)]'
          "
          :aria-label="
            locked ? t.spacingControl.unlock : t.spacingControl.lockAll
          "
          :title="locked ? t.spacingControl.unlock : t.spacingControl.lockAll"
          @click="toggleLock"
        >
          <Lock v-if="locked" :size="14" :stroke-width="2" />
          <LockOpen v-else :size="14" :stroke-width="2" />
        </button>

        <!-- Right -->
        <div class="tpl:flex tpl:items-center">
          <button
            :aria-label="t.spacingControl.decreaseRight"
            :class="[stepperBtnClass, 'tpl:rounded-l-[var(--tpl-radius-sm)]']"
            @click="updateValue('right', -1)"
          >
            <Minus :size="12" :stroke-width="2" />
          </button>
          <input
            type="number"
            :class="inputClass"
            :value="modelValue.right"
            min="0"
            @input="
              setDirectValue(
                'right',
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
          <button
            :aria-label="t.spacingControl.increaseRight"
            :class="[stepperBtnClass, 'tpl:rounded-r-[var(--tpl-radius-sm)]']"
            @click="updateValue('right', 1)"
          >
            <Plus :size="12" :stroke-width="2" />
          </button>
        </div>
      </div>

      <!-- Bottom -->
      <div class="tpl:flex tpl:items-center">
        <button
          :aria-label="t.spacingControl.decreaseBottom"
          :class="[stepperBtnClass, 'tpl:rounded-l-[var(--tpl-radius-sm)]']"
          @click="updateValue('bottom', -1)"
        >
          <Minus :size="12" :stroke-width="2" />
        </button>
        <input
          type="number"
          :class="inputClass"
          :value="modelValue.bottom"
          min="0"
          @input="
            setDirectValue(
              'bottom',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
        <button
          :aria-label="t.spacingControl.increaseBottom"
          :class="[stepperBtnClass, 'tpl:rounded-r-[var(--tpl-radius-sm)]']"
          @click="updateValue('bottom', 1)"
        >
          <Plus :size="12" :stroke-width="2" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>
