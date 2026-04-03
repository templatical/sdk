<script setup lang="ts">
import { ref, watch } from "vue";
import { onClickOutside } from "@vueuse/core";
import { useI18n } from "../composables/useI18n";
import { colorTextClass } from "../constants/styleConstants";
import "vanilla-colorful";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    size?: "default" | "large";
    swatchOnly?: boolean;
    disabled?: boolean;
  }>(),
  {
    placeholder: "#000000",
    size: "default",
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

onClickOutside(
  popoverRef,
  () => {
    open.value = false;
  },
  { ignore: [swatchRef] },
);

const internalColor = ref(props.modelValue || "#000000");

watch(
  () => props.modelValue,
  (val) => {
    internalColor.value = val || "#000000";
  },
);

function onPickerChange(e: Event) {
  const value = (e as CustomEvent).detail.value;
  internalColor.value = value;
  emit("update:modelValue", value);
}

function onTextInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  internalColor.value = value;
  emit("update:modelValue", value);
}
</script>

<template>
  <div
    :class="[
      'tpl:flex tpl:gap-2 tpl:relative',
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
        size === 'large' ? 'tpl:size-12' : 'tpl:size-10',
      ]"
      @click="!disabled && (open = !open)"
    >
      <span
        class="tpl:block tpl:size-full tpl:rounded-[calc(var(--tpl-radius-sm)-2px)]"
        :style="{ backgroundColor: internalColor }"
      />
    </button>
    <input
      v-if="!swatchOnly"
      type="text"
      :class="colorTextClass"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="t.colorPicker.hexValue"
      @input="onTextInput"
    />
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
          :color="internalColor"
          :aria-label="t.colorPicker.pickColor"
          @color-changed="onPickerChange"
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
</style>
