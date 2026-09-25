<script setup lang="ts">
import NumberWithSuffix from "./NumberWithSuffix.vue";
import LinkToggle from "./LinkToggle.vue";
import { useI18n } from "../../composables/useI18n";
import type {
  BorderCorner,
  BorderRadiusValue,
  CornerRadius,
} from "@templatical/types";
import { BORDER_CORNERS } from "@templatical/types";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  modelValue: BorderRadiusValue | undefined;
  label: string;
  /** Prefix for the inputs' `data-testid`s, e.g. `"image"`. */
  testidPrefix: string;
  max?: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: BorderRadiusValue): void;
}>();

const { t } = useI18n();

const CORNER_LABEL_KEYS = {
  topLeft: "cornerTopLeft",
  topRight: "cornerTopRight",
  bottomRight: "cornerBottomRight",
  bottomLeft: "cornerBottomLeft",
} as const satisfies Record<BorderCorner, string>;

// Laid out as the box reads: top row, then bottom row.
const GRID_ORDER: readonly BorderCorner[] = [
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
];

const corners = computed<CornerRadius>(() => {
  const radius = props.modelValue ?? 0;
  if (typeof radius === "number") {
    return {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    };
  }
  return radius;
});

const isUniform = computed(() =>
  BORDER_CORNERS.every(
    (corner) => corners.value[corner] === corners.value.topLeft,
  ),
);

// Mirrors SpacingControl: linked while every corner matches, and a value
// whose corners differ unlinks it so each corner stays editable.
const linked = ref(isUniform.value);
watch(isUniform, (uniform) => {
  if (!uniform && linked.value) linked.value = false;
});

// A negative (or unparseable) entry is ignored rather than clamped, so the
// stored radius survives until the user types a real one.
function isValid(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function updateAll(value: number): void {
  if (!isValid(value)) return;
  // Linked corners store a plain number — the shape every existing template
  // already has.
  emit("update:modelValue", value);
}

function updateCorner(corner: BorderCorner, value: number): void {
  if (!isValid(value)) return;
  emit("update:modelValue", { ...corners.value, [corner]: value });
}

function toggleLinked(): void {
  linked.value = !linked.value;
  if (linked.value) {
    emit("update:modelValue", corners.value.topLeft);
  }
}
</script>

<template>
  <div class="tpl:mb-3.5">
    <div class="tpl:mb-2 tpl:flex tpl:items-center tpl:justify-between">
      <span
        class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >{{ label }}</span
      >
      <LinkToggle
        :linked="linked"
        :link-label="t.blockSettings.linkCorners"
        :unlink-label="t.blockSettings.unlinkCorners"
        :testid="`${testidPrefix}-border-radius-link`"
        @toggle="toggleLinked"
      />
    </div>
    <NumberWithSuffix
      v-if="linked"
      :model-value="corners.topLeft"
      :min="0"
      :max="max"
      suffix="px"
      :testid="`${testidPrefix}-border-radius-input`"
      @update:model-value="updateAll"
    />
    <div v-else class="tpl:grid tpl:grid-cols-2 tpl:gap-2">
      <div v-for="corner in GRID_ORDER" :key="corner">
        <label
          class="tpl:mb-1 tpl:block tpl:text-[10px] tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
          >{{ t.blockSettings[CORNER_LABEL_KEYS[corner]] }}</label
        >
        <NumberWithSuffix
          :model-value="corners[corner]"
          :min="0"
          :max="max"
          suffix="px"
          :testid="`${testidPrefix}-border-radius-${corner}-input`"
          @update:model-value="updateCorner(corner, $event)"
        />
      </div>
    </div>
  </div>
</template>
