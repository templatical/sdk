<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { X } from "@lucide/vue";
import { useI18n } from "../composables/useI18n";
import { usePopoverRoot } from "../composables/usePopoverRoot";
import { usePopoverPosition } from "../composables/usePopoverPosition";
import { colorTextClass } from "../constants/styleConstants";
import { canonicalizeHexColor, normalizeColorToHex } from "../utils/color";
import { COLORS_KEY, THEME_STYLES_KEY, UI_THEME_KEY } from "../keys";
import { DEFAULT_RESOLVED_COLORS } from "../utils/resolveColorsConfig";
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
    /**
     * Swatch trigger size. `"md"` (40px) is the default for sidebar panels;
     * `"sm"` (32px) matches the compact rich-text floating toolbar controls.
     */
    size?: "sm" | "md";
    /**
     * Accessible label (and hover title) for the swatch trigger. Falls back to
     * the generic "pick color" label. Set it when several pickers sit side by
     * side and must be told apart (e.g. text color vs highlight in the toolbar).
     */
    ariaLabel?: string;
    /**
     * Per-instance override of the editor-wide `colors.presets` for this one
     * picker. This is the extension seam a caller uses to scope a single picker
     * to its own palette; when omitted, the injected editor-level presets apply.
     */
    presets?: string[];
    /**
     * Per-instance override of the editor-wide `colors.allowCustom` for this one
     * picker. When omitted, the injected editor-level setting applies.
     */
    allowCustom?: boolean;
  }>(),
  {
    placeholder: "",
    seedColor: "#ffffff",
    swatchOnly: false,
    disabled: false,
    size: "md",
    ariaLabel: "",
    presets: undefined,
    allowCustom: undefined,
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

// vanilla-colorful and the hex field are hex-only, but a stored value read back
// from the DOM (e.g. a TipTap textStyle/highlight color) can be `rgb(...)`. Show
// and seed the wheel with the hex form; the raw value still drives unset/emit.
const displayValue = computed(() => normalizeColorToHex(props.modelValue));

// The color handed to the wheel: the stored value, or the seed when unset.
const seed = computed(() =>
  normalizeColorToHex(props.modelValue || props.seedColor),
);

// The clear (×) sits inside whichever hex field is active — the inline field in
// full mode, or the popover field in swatch-only mode — shown only when a value
// is set. Not gated on swatchOnly: each field renders only in its own mode.
const showClear = computed(() => !props.disabled && !isUnset.value);

// Color palette: a per-instance `presets`/`allowCustom` prop wins over the
// injected editor-wide `colors` config, per property. Default keeps the picker
// unchanged when neither is configured. "preset" is kept distinct from the
// trigger "swatch" (swatchOnly/swatchRef) on purpose — they are two different
// concepts in this file.
const editorColors = inject(COLORS_KEY, DEFAULT_RESOLVED_COLORS);
// Deduplicated: a repeated entry in the configured palette would render a
// pointless second chip and collide on the value-based `v-for` key.
const presets = computed(() => [
  ...new Set(props.presets ?? editorColors.presets),
]);
const allowCustom = computed(
  () => props.allowCustom ?? editorColors.allowCustom,
);
const hasPresets = computed(() => presets.value.length > 0);

// Show the free-form controls (wheel + hex inputs) whenever custom entry is
// allowed OR there are no presets to fall back on — so a picker is never left
// with no way to choose a color (a belt-and-braces guard; `resolveColorsConfig`
// already forbids `allowCustom: false` without presets).
const showFreeform = computed(() => allowCustom.value || !hasPresets.value);

// A preset reads as selected when its hex equals the current value, compared in
// the canonical (rgb→hex, 3-digit expanded, lowercased) form — so a `#abc`
// preset matches an `#aabbcc` browser round-trip and case never matters.
const normalizedValue = computed(() => canonicalizeHexColor(props.modelValue));
function isPresetSelected(preset: string): boolean {
  return (
    normalizedValue.value !== "" &&
    canonicalizeHexColor(preset) === normalizedValue.value
  );
}
function selectPreset(preset: string): void {
  emit("update:modelValue", preset);
}

// A leading "no colour" (unset/inherit) chip is rendered ONLY in locked mode
// (`!showFreeform`) — the one mode with no other clear affordance. The freeform
// modes already own clear via the hex-field ×; a preset-only grid otherwise has
// no way back to unset once a colour is picked.
const showNoneChip = computed(() => hasPresets.value && !showFreeform.value);

// Group-position of preset `index`, shifted by the leading none chip when it's
// present, so the whole grid indexes as one radio list.
function presetPosition(index: number): number {
  return showNoneChip.value ? index + 1 : index;
}

// Roving tabindex (WAI-ARIA APG radio group): the grid exposes exactly one tab
// stop — the checked radio, or the FIRST radio when nothing is checked (value
// unset with no none chip, or off-palette) — so the group is reachable by Tab
// but a single Tab steps past it. The none chip counts as checked when the
// value is unset. Arrow keys then rove focus between the radios.
const rovingIndex = computed(() => {
  if (showNoneChip.value && isUnset.value) {
    return 0;
  }
  const selected = presets.value.findIndex((preset) =>
    isPresetSelected(preset),
  );
  return selected === -1 ? 0 : presetPosition(selected);
});
function noneChipTabindex(): number {
  return rovingIndex.value === 0 ? 0 : -1;
}
function presetTabindex(index: number): number {
  return presetPosition(index) === rovingIndex.value ? 0 : -1;
}

// Arrow keys rove FOCUS across the chips (wrapping); they do NOT select.
// Enter/Space activate the focused chip via native button click. This
// deviates from APG's default "selection follows focus" on purpose: every
// selection emits `update:modelValue`, and on the rich-text toolbar path that
// runs `editor.chain().focus().setColor()` (see the swatch-only field comment
// in the template), which refocuses the canvas — so following focus would
// steal focus after the first arrow key and break traversal. APG sanctions
// explicit activation when moving focus has side effects.
function onPresetGridKeydown(e: KeyboardEvent): void {
  const arrows = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!arrows.includes(e.key)) {
    return;
  }
  // Resolve the current chip from `event.target`, never `document.activeElement`
  // — the latter is unreliable across a shadow-DOM boundary (this editor can
  // mount in a shadow root; the repo threads the real root via EDITOR_ROOT_KEY
  // for the same reason).
  const group = e.currentTarget as HTMLElement;
  const radios = Array.from(
    group.querySelectorAll<HTMLElement>('[role="radio"]'),
  );
  const current = (e.target as HTMLElement).closest('[role="radio"]');
  const currentIndex = current ? radios.indexOf(current as HTMLElement) : -1;
  if (currentIndex === -1) {
    return;
  }
  const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
  const nextIndex =
    (currentIndex + (forward ? 1 : -1) + radios.length) % radios.length;
  radios[nextIndex]?.focus();
  e.preventDefault();
}

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

// The popover teleports to the shared popover root so it escapes any clipping /
// overflow-hidden ancestor (e.g. the link dialog's card, where clicking the
// clipped wheel landed on the backdrop and closed the modal). Position is
// captured from the swatch on open and applied as `absolute`, in coordinates
// local to the popover root (`toLocal`) so a transformed ancestor of the
// editor doesn't offset it — see usePopoverPosition.
const popoverRoot = usePopoverRoot();
const { toLocal } = usePopoverPosition();
const themeStyles = inject(THEME_STYLES_KEY, null);
const tplUiTheme = inject(UI_THEME_KEY, null);
const popoverPosition = ref({ top: 0, left: 0 });

function toggleOpen(): void {
  if (props.disabled) return;
  if (!open.value) {
    const rect = swatchRef.value?.getBoundingClientRect();
    if (rect) {
      const PICKER_HEIGHT = 240; // wheel + hue slider + padding, approx
      const gap = 8;
      // Open below the swatch, or flip above when it would overflow the viewport
      // bottom — the popover is `fixed`, so it can't scroll into view otherwise.
      const fitsBelow = rect.bottom + gap + PICKER_HEIGHT <= window.innerHeight;
      const viewportTop = fitsBelow
        ? rect.bottom + gap
        : Math.max(gap, rect.top - PICKER_HEIGHT - gap);
      popoverPosition.value = toLocal({ top: viewportTop, left: rect.left });
    }
  }
  open.value = !open.value;
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
      :aria-label="ariaLabel || t.colorPicker.pickColor"
      :title="ariaLabel || undefined"
      :aria-expanded="open"
      :class="[
        'tpl:shrink-0 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-0.5 tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]',
        disabled ? 'tpl:cursor-not-allowed' : 'tpl:cursor-pointer',
        open
          ? 'tpl:border-[var(--tpl-primary)] tpl:shadow-[var(--tpl-ring)]'
          : !disabled && 'hover:tpl:border-[var(--tpl-text-dim)]',
        size === 'sm' ? 'tpl:size-8' : 'tpl:size-10',
      ]"
      @click="toggleOpen"
    >
      <span
        class="tpl:block tpl:size-full tpl:rounded-[calc(var(--tpl-radius-sm)-2px)]"
        :class="{ 'tpl-color-swatch-empty': isUnset }"
        :style="isUnset ? undefined : { backgroundColor: displayValue }"
      />
    </button>
    <div v-if="!swatchOnly && showFreeform" class="tpl:relative tpl:flex-1">
      <input
        type="text"
        :class="[colorTextClass, 'tpl:w-full']"
        :style="showClear ? { paddingRight: '2.25rem' } : undefined"
        :value="displayValue"
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
    <Teleport :to="popoverRoot" :disabled="!popoverRoot">
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
          :data-tpl-theme="tplUiTheme"
          class="tpl-color-popover tpl:absolute tpl:z-modal tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:p-3 tpl:shadow-lg"
          :style="{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            ...themeStyles,
          }"
        >
          <!-- Preset color grid — an ARIA radio group: each chip is a
               `role="radio"`, arrow keys rove focus between them (roving
               tabindex), and Enter/Space activate. Supplements the wheel/hex
               field; the only control when `allowCustom` is false. Each preset
               carries its color value as its accessible label. -->
          <div
            v-if="hasPresets"
            role="radiogroup"
            :aria-label="t.colorPicker.presetColors"
            :class="[
              'tpl:flex tpl:flex-wrap tpl:gap-1.5',
              showFreeform && 'tpl:mb-2',
            ]"
            @keydown="onPresetGridKeydown"
          >
            <!-- Leading "no colour" (unset/inherit) chip — locked mode only.
                 Always present, never gated on the current value: unset is a
                 first-class member of the value domain, and a chip that
                 disappeared on activation would strand keyboard focus mid-grid.
                 Reuses the diagonal-slash unset visual and the same chip
                 chrome; activating it emits "" to clear. -->
            <button
              v-if="showNoneChip"
              type="button"
              role="radio"
              :aria-label="t.colorPicker.clear"
              :title="t.colorPicker.clear"
              :aria-checked="isUnset"
              :tabindex="noneChipTabindex()"
              :class="[
                'tpl-color-swatch-empty tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:outline-none tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:focus-visible:ring-2 tpl:focus-visible:ring-[var(--tpl-primary)] tpl:focus-visible:ring-offset-1 tpl:focus-visible:ring-offset-[var(--tpl-bg-elevated)]',
                isUnset
                  ? 'tpl:ring-2 tpl:ring-[var(--tpl-primary)] tpl:ring-offset-1 tpl:ring-offset-[var(--tpl-bg-elevated)]'
                  : 'hover:tpl:border-[var(--tpl-text-dim)]',
              ]"
              @click="clear"
            />
            <button
              v-for="(preset, index) in presets"
              :key="preset"
              type="button"
              role="radio"
              :aria-label="preset"
              :title="preset"
              :aria-checked="isPresetSelected(preset)"
              :tabindex="presetTabindex(index)"
              :style="{ backgroundColor: preset }"
              :class="[
                'tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:outline-none tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:focus-visible:ring-2 tpl:focus-visible:ring-[var(--tpl-primary)] tpl:focus-visible:ring-offset-1 tpl:focus-visible:ring-offset-[var(--tpl-bg-elevated)]',
                isPresetSelected(preset)
                  ? 'tpl:ring-2 tpl:ring-[var(--tpl-primary)] tpl:ring-offset-1 tpl:ring-offset-[var(--tpl-bg-elevated)]'
                  : 'hover:tpl:border-[var(--tpl-text-dim)]',
              ]"
              @click="selectPreset(preset)"
            />
          </div>
          <hex-color-picker
            v-if="showFreeform"
            :color="seed"
            :aria-label="t.colorPicker.pickColor"
            @color-changed="onPickerChange"
            @pointerdown="onPickerPointerDown"
            @pointerup="onPickerPointerUp"
            @keydown.escape="open = false"
          />
          <!-- Swatch-only mode has no inline field beside the swatch, so the
               popover carries the manual hex field (+ inline × clear) — the same
               control as the full-mode sidebar field. It commits on change/Enter,
               NOT @input: in the rich-text toolbar every emit calls
               editor.chain().focus().setColor(), and focusing the canvas mid-type
               would steal focus after the first character. Shown even when unset
               so a first color can be typed; the × appears only once a value is set. -->
          <div v-if="swatchOnly && showFreeform" class="tpl:relative tpl:mt-2">
            <input
              type="text"
              :class="[colorTextClass, 'tpl:w-full']"
              :style="showClear ? { paddingRight: '2.25rem' } : undefined"
              :value="displayValue"
              :placeholder="placeholder || t.colorPicker.notSet"
              :disabled="disabled"
              :aria-label="t.colorPicker.hexValue"
              @change="onTextInput"
              @keydown.enter.prevent="
                ($event.target as HTMLInputElement).blur()
              "
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
        </div>
      </Transition>
    </Teleport>
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
