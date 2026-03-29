<script setup lang="ts">
import ColorPicker from "./ColorPicker.vue";
import MergeTagTextarea from "./MergeTagTextarea.vue";
import { useI18n } from "../composables/useI18n";
import type { UseFontsReturn } from "../composables/useFonts";
import type { TemplateSettings } from "@templatical/types";
import {
  cardClass,
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../constants/styleConstants";
import { Circle, Eye, Info, Square } from "lucide-vue-next";
import { computed, inject } from "vue";

const props = defineProps<{
  settings: TemplateSettings;
}>();

const emit = defineEmits<{
  (e: "update", settings: Partial<TemplateSettings>): void;
}>();

const PREHEADER_MAX_LENGTH = 150;

const { t } = useI18n();

const fontsManager = inject<UseFontsReturn>("fontsManager")!;
const fontFamilies = computed(() => fontsManager.fonts.value);

// If current font is not in available list (e.g., custom font when disabled), use default
const displayedFontFamily = computed(() => {
  const isAvailable = fontFamilies.value.some(
    (font) => font.value === props.settings.fontFamily,
  );
  return isAvailable
    ? props.settings.fontFamily
    : fontsManager.defaultFont.value;
});

const widthPresets = [
  { value: 480, label: "480px" },
  { value: 600, label: "600px" },
  { value: 700, label: "700px" },
  { value: 800, label: "800px" },
];
</script>

<template>
  <aside
    class="tpl:flex tpl:w-full tpl:flex-1 tpl:flex-col tpl:bg-[var(--tpl-bg-elevated)]"
  >
    <div
      class="tpl:flex tpl:flex-1 tpl:flex-col tpl:gap-3 tpl:overflow-y-auto tpl:p-4"
    >
      <!-- Layout card -->
      <div :class="cardClass">
        <div
          class="tpl:mb-3.5 tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Square
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.layout }}</span>
        </div>

        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{
            t.templateSettings.widthPreset
          }}</label>
          <div
            class="tpl:grid tpl:grid-cols-4 tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1"
            style="background-color: var(--tpl-bg-hover)"
          >
            <button
              v-for="preset in widthPresets"
              :key="preset.value"
              class="tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-2 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
              :style="{
                backgroundColor:
                  settings.width === preset.value
                    ? 'var(--tpl-bg)'
                    : 'transparent',
                color:
                  settings.width === preset.value
                    ? 'var(--tpl-primary)'
                    : 'var(--tpl-text-muted)',
                boxShadow:
                  settings.width === preset.value
                    ? 'var(--tpl-shadow)'
                    : 'none',
              }"
              @click="emit('update', { width: preset.value })"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div>
          <label :class="labelClass">{{
            t.templateSettings.customWidth
          }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="settings.width"
              min="300"
              max="900"
              @input="
                emit('update', {
                  width: Number(($event.target as HTMLInputElement).value),
                })
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
      </div>

      <!-- Appearance card -->
      <div :class="cardClass">
        <div
          class="tpl:mb-3.5 tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Circle
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.appearance }}</span>
        </div>

        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{
            t.templateSettings.backgroundColor
          }}</label>
          <ColorPicker
            :model-value="settings.backgroundColor"
            placeholder="#ffffff"
            @update:model-value="emit('update', { backgroundColor: $event })"
          />
        </div>

        <div>
          <label :class="labelClass">{{ t.templateSettings.fontFamily }}</label>
          <select
            :class="inputClass"
            :value="displayedFontFamily"
            @change="
              emit('update', {
                fontFamily: ($event.target as HTMLSelectElement).value,
              })
            "
          >
            <option
              v-for="font in fontFamilies"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Preheader card -->
      <div :class="cardClass">
        <div
          class="tpl:mb-3.5 tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Eye
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.preheaderText }}</span>
        </div>

        <div>
          <MergeTagTextarea
            :model-value="settings.preheaderText ?? ''"
            :placeholder="t.templateSettings.preheaderTextPlaceholder"
            :rows="2"
            @update:model-value="
              emit('update', {
                preheaderText: $event.replace(/[\r\n]/g, ' ') || undefined,
              })
            "
          />
          <div
            class="tpl:mt-1 tpl:flex tpl:items-start tpl:justify-between tpl:gap-2"
          >
            <span
              class="tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-text-dim)]"
            >
              {{ t.templateSettings.preheaderTextHint }}
            </span>
            <span
              class="tpl:shrink-0 tpl:text-xs tpl:tabular-nums tpl:text-[var(--tpl-text-dim)]"
            >
              {{ (settings.preheaderText ?? "").length }}/{{
                PREHEADER_MAX_LENGTH
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Tips card -->
      <div
        class="tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-3"
      >
        <div
          class="tpl:mb-2.5 tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text-muted)]"
        >
          <Info :size="14" :stroke-width="2" />
          <span>{{ t.templateSettings.tips }}</span>
        </div>
        <ul
          class="tpl:m-0 tpl:pl-[18px] tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-text-dim)]"
        >
          <li class="tpl:mb-1 tpl:last:mb-0">
            {{ t.templateSettings.tip1 }}
          </li>
          <li class="tpl:mb-1 tpl:last:mb-0">
            {{ t.templateSettings.tip2 }}
          </li>
          <li class="tpl:mb-1 tpl:last:mb-0">
            {{ t.templateSettings.tip3 }}
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>
