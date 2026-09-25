<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import NumberWithSuffix from "./NumberWithSuffix.vue";
import LinkToggle from "./LinkToggle.vue";
import { useI18n } from "../../composables/useI18n";
import { labelClass } from "../../constants/styleConstants";
import type {
  BorderSide,
  BorderSideValue,
  BorderStyle,
  BorderValue,
} from "@templatical/types";
import { BORDER_SIDES, uniformBorder } from "@templatical/types";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  modelValue: BorderValue | undefined;
  /** Prefix for the inputs' `data-testid`s, e.g. `"image"`. */
  testidPrefix: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: BorderValue | undefined): void;
}>();

const { t } = useI18n();

// What a side starts as the first time a width is entered on it.
const DEFAULT_SIDE: BorderSideValue = {
  width: 0,
  style: "solid",
  color: "#000000",
};

function sameSide(a: BorderSideValue, b: BorderSideValue): boolean {
  return a.width === b.width && a.style === b.style && a.color === b.color;
}

const isUniform = computed(() => {
  const border = props.modelValue;
  if (!border) return true;
  return BORDER_SIDES.every((side) => sameSide(border[side], border.top));
});

// Mirrors SpacingControl: linked while every side matches, and a value whose
// sides differ unlinks it so each side stays editable.
const linked = ref(isUniform.value);
watch(isUniform, (uniform) => {
  if (!uniform && linked.value) linked.value = false;
});

const activeSide = ref<BorderSide>("top");

const current = computed<BorderSideValue>(() => {
  const side = linked.value ? "top" : activeSide.value;
  return props.modelValue?.[side] ?? DEFAULT_SIDE;
});

const isDrawn = (side: BorderSideValue | undefined): boolean =>
  !!side && side.width > 0;

function setSide(value: BorderSideValue): void {
  if (linked.value) {
    // 0 removes the border entirely rather than storing four `0px` sides.
    emit(
      "update:modelValue",
      isDrawn(value) ? uniformBorder(value) : undefined,
    );
    return;
  }
  const next: BorderValue = {
    ...(props.modelValue ?? uniformBorder(DEFAULT_SIDE)),
    [activeSide.value]: value,
  };
  const anyDrawn = BORDER_SIDES.some((side) => isDrawn(next[side]));
  emit("update:modelValue", anyDrawn ? next : undefined);
}

function updateWidth(width: number): void {
  setSide({ ...current.value, width: width > 0 ? width : 0 });
}

function updateField(patch: Partial<BorderSideValue>): void {
  setSide({ ...current.value, ...patch });
}

function toggleLinked(): void {
  if (linked.value) {
    linked.value = false;
    return;
  }
  linked.value = true;
  const border = props.modelValue;
  if (!border) return;
  // Linking copies one side to all four: the side being edited if it is
  // drawn, otherwise the first drawn one.
  const source = isDrawn(border[activeSide.value])
    ? border[activeSide.value]
    : BORDER_SIDES.map((side) => border[side]).find(isDrawn);
  emit("update:modelValue", source ? uniformBorder(source) : undefined);
}

const sideOptions = computed(() =>
  BORDER_SIDES.map((side) => ({ value: side, label: t.spacingControl[side] })),
);
</script>

<template>
  <div class="tpl:mb-3.5">
    <div class="tpl:mb-2 tpl:flex tpl:items-center tpl:justify-between">
      <span
        class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >{{ t.blockSettings.border }}</span
      >
      <LinkToggle
        :linked="linked"
        :link-label="t.blockSettings.linkSides"
        :unlink-label="t.blockSettings.unlinkSides"
        :testid="`${testidPrefix}-border-link`"
        @toggle="toggleLinked"
      />
    </div>
    <div v-if="!linked" class="tpl:mb-3.5">
      <label :class="labelClass">{{ t.blockSettings.borderSide }}</label>
      <SlidingPillSelect
        :options="sideOptions"
        :model-value="activeSide"
        @update:model-value="activeSide = $event as BorderSide"
      />
    </div>
    <div class="tpl:mb-3.5">
      <label :class="labelClass">{{ t.blockSettings.borderWidth }}</label>
      <NumberWithSuffix
        :model-value="current.width"
        :min="0"
        suffix="px"
        :testid="`${testidPrefix}-border-width-input`"
        @update:model-value="updateWidth"
      />
    </div>
    <template v-if="current.width > 0">
      <div class="tpl:mb-3.5">
        <label :class="labelClass">{{ t.blockSettings.borderStyle }}</label>
        <SlidingPillSelect
          :options="[
            { value: 'solid', label: t.divider.solid },
            { value: 'dashed', label: t.divider.dashed },
            { value: 'dotted', label: t.divider.dotted },
          ]"
          :model-value="current.style"
          @update:model-value="updateField({ style: $event as BorderStyle })"
        />
      </div>
      <div>
        <label :class="labelClass">{{ t.blockSettings.borderColor }}</label>
        <ColorPicker
          :model-value="current.color"
          @update:model-value="updateField({ color: $event })"
        />
      </div>
    </template>
  </div>
</template>
