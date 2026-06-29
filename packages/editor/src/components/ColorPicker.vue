<script setup lang="ts">
import { computed, ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { X } from "@lucide/vue";
import { useI18n } from "../composables/useI18n";
import { colorTextClass } from "../constants/styleConstants";
import "vanilla-colorful";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    /**
     * Color the picker wheel opens on while the field is unset. It only
     * positions the wheel — it never paints the swatch or fills the input,
     * so an unset field still reads as "not set".
     */
    seedColor?: string;
    swatchOnly?: boolean;
    disabled?: boolean;
  }>(),
  {
    placeholder: "",
    seedColor: "#ffffff",
    swatchOnly: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();

const open = ref(false);
const popoverRef = ref<HTMLElement>();
const swatchRef = ref<HTMLElement>();

// Whether the picker emitted a real change during the current pointer gesture.
// vanilla-colorful only fires `color-changed` when the chosen color differs
// from the one the wheel was seeded with — so picking a color equal to the
// seed emits nothing. When the field is still unset after such a no-change
// pick, we commit the seed ourselves on pointerup so the value persists
// (otherwise e.g. white on an empty background can never be set — issue #282).
const pickerTouched = ref(false);

onClickOutside(
  popoverRef,
  () => {
    open.value = false;
  },
  { ignore: [swatchRef] },
);

const isUnset = computed(() => !props.modelValue);

// The color handed to the wheel: the stored value, or the seed when unset.
const seed = computed(() => props.modelValue || props.seedColor);

// The clear (×) lives inside the input, shown only when a value is set.
const showClear = computed(
  () => !props.swatchOnly && !props.disabled && !isUnset.value,
);

function onPickerChange(e: Event): void {
  pickerTouched.value = true;
  emit("update:modelValue", (e as CustomEvent).detail.value);
}

function onPickerPointerDown(): void {
  pickerTouched.value = false;
}

function onPickerPointerUp(): void {
  // A deliberate pick equal to the seed fires no `color-changed`; commit it.
  if (!pickerTouched.value && isUnset.value) {
    emit("update:modelValue", seed.value);
  }
}

function onTextInput(e: Event): void {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}

function clear(): void {
  emit("update:modelValue", "");
}
</script>

<template>
  <div
    :class="[
      'tpl:flex tpl:items-center tpl:gap-2 tpl:relative',
      disabled && 'tpl:opacity-60 tpl:cursor-not-allowed',
    ]"
  >
    <button
      ref="swatchRef"
      type="button"
      :disabled="disabled"
      :aria-label="t.colorPicker.pickColor"
      :aria-expanded="open"
      :class="[
        'tpl:shrink-0 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-0.5 tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]',
        disabled ? 'tpl:cursor-not-allowed' : 'tpl:cursor-pointer',
        open
          ? 'tpl:border-[var(--tpl-primary)] tpl:shadow-[var(--tpl-ring)]'
          : !disabled && 'hover:tpl:border-[var(--tpl-text-dim)]',
        'tpl:size-10',
      ]"
      @click="!disabled && (open = !open)"
    >
      <span
        class="tpl:block tpl:size-full tpl:rounded-[calc(var(--tpl-radius-sm)-2px)]"
        :class="{ 'tpl-color-swatch-empty': isUnset }"
        :style="isUnset ? undefined : { backgroundColor: modelValue }"
      />
    </button>
    <div v-if="!swatchOnly" class="tpl:relative tpl:flex-1">
      <input
        type="text"
        :class="[colorTextClass, 'tpl:w-full']"
        :style="showClear ? { paddingRight: '2.25rem' } : undefined"
        :value="modelValue"
        :placeholder="placeholder || t.colorPicker.notSet"
        :disabled="disabled"
        :aria-label="t.colorPicker.hexValue"
        @input="onTextInput"
      />
      <button
        v-if="showClear"
        type="button"
        :aria-label="t.colorPicker.clear"
        :title="t.colorPicker.clear"
        class="tpl:absolute tpl:right-2 tpl:top-1/2 tpl:flex tpl:size-6 tpl:-translate-y-1/2 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:text-[var(--tpl-text-dim)] tpl:transition-colors tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:bg-[var(--tpl-bg-hover)] hover:tpl:text-[var(--tpl-text)]"
        @click="clear"
      >
        <X :size="14" :stroke-width="1.5" />
      </button>
    </div>
    <Transition
      enter-active-class="tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
      enter-from-class="tpl:opacity-0 tpl:scale-95 tpl:translate-y-1"
      enter-to-class="tpl:opacity-100 tpl:scale-100 tpl:translate-y-0"
      leave-active-class="tpl:transition-all tpl:duration-[80ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
      leave-from-class="tpl:opacity-100 tpl:scale-100 tpl:translate-y-0"
      leave-to-class="tpl:opacity-0 tpl:scale-95 tpl:translate-y-1"
    >
      <div
        v-if="open"
        ref="popoverRef"
        class="tpl:absolute tpl:left-0 tpl:top-full tpl:z-50 tpl:mt-2 tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:p-3 tpl:shadow-lg"
      >
        <hex-color-picker
          :color="seed"
          :aria-label="t.colorPicker.pickColor"
          @color-changed="onPickerChange"
          @pointerdown="onPickerPointerDown"
          @pointerup="onPickerPointerUp"
          @keydown.escape="open = false"
        />
      </div>
    </Transition>
  </div>
</template>

<style>
hex-color-picker {
  --hcp-width: 200px;
}

hex-color-picker::part(hue) {
  border-radius: var(--tpl-radius-sm, 7px);
}

hex-color-picker::part(saturation) {
  border-radius: var(--tpl-radius-sm, 7px) var(--tpl-radius-sm, 7px) 0 0;
}

/* Unset swatch: paper with a single thin diagonal slash = "no color set".
   A neutral non-color signal — never Signal Amber (intent) or Danger. */
.tpl-color-swatch-empty {
  background-color: var(--tpl-bg);
  background-image: linear-gradient(
    to top right,
    transparent calc(50% - 0.75px),
    var(--tpl-text-dim) calc(50% - 0.75px),
    var(--tpl-text-dim) calc(50% + 0.75px),
    transparent calc(50% + 0.75px)
  );
}
</style>
