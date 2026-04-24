<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SpacingControl from "../SpacingControl.vue";
import CollapsibleSection from "./CollapsibleSection.vue";
import { useI18n } from "../../composables/useI18n";
import {
  labelClass,
  monoTextareaClass,
  DEFAULT_BG_COLOR,
} from "../../constants/styleConstants";
import type { Block, DisplayCondition } from "@templatical/types";
import { Monitor, Smartphone, Tablet } from "@lucide/vue";
import { computed, inject, reactive, ref, watch, type Component } from "vue";
import {
  DISPLAY_CONDITIONS_KEY,
  ALLOW_CUSTOM_CONDITIONS_KEY,
} from "../../keys";

type SectionKey = "spacing" | "bg" | "display" | "css" | "condition";
type VisibilityKey = "desktop" | "tablet" | "mobile";

const props = defineProps<{
  block: Block;
  isFirstSection?: boolean;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<Block>): void;
}>();

const { t } = useI18n();

const displayConditions = inject(DISPLAY_CONDITIONS_KEY, []);
const allowCustomConditions = inject(ALLOW_CUSTOM_CONDITIONS_KEY, false);

const openSections = reactive(new Set<SectionKey>());
const customConditionMode = ref(false);
const customBefore = ref("");
const customAfter = ref("");

const VISIBILITY_ITEMS: { key: VisibilityKey; icon: Component; labelKey: "showOnDesktop" | "showOnTablet" | "showOnMobile" }[] = [
  { key: "desktop", icon: Monitor, labelKey: "showOnDesktop" },
  { key: "tablet", icon: Tablet, labelKey: "showOnTablet" },
  { key: "mobile", icon: Smartphone, labelKey: "showOnMobile" },
];

function toggleSection(key: SectionKey): void {
  if (openSections.has(key)) openSections.delete(key);
  else openSections.add(key);
}

const hasDisplayConditions = computed(
  () => displayConditions.length > 0 || allowCustomConditions,
);

const isCustomCondition = computed(() => {
  if (!props.block.displayCondition) return false;
  return !displayConditions.some(
    (c) => c.label === props.block.displayCondition?.label,
  );
});

function startCustomCondition(): void {
  customConditionMode.value = true;
  if (isCustomCondition.value && props.block.displayCondition) {
    customBefore.value = props.block.displayCondition.before;
    customAfter.value = props.block.displayCondition.after ?? "";
  } else {
    customBefore.value = "";
    customAfter.value = "";
  }
}

function applyCustomCondition(): void {
  if (!customBefore.value.trim()) return;
  emit("update", {
    displayCondition: {
      label: t.blockSettings.customCondition,
      before: customBefore.value.trim(),
      after: customAfter.value.trim(),
    },
  });
  customConditionMode.value = false;
  customBefore.value = "";
  customAfter.value = "";
}

watch(
  () => props.block.displayCondition,
  (condition) => {
    if (!condition) {
      customConditionMode.value = false;
      customBefore.value = "";
      customAfter.value = "";
      return;
    }
    if (isCustomCondition.value) {
      customBefore.value = condition.before;
      customAfter.value = condition.after ?? "";
    }
  },
  { immediate: true },
);

const groupedDisplayConditions = computed(() => {
  const groups: Record<string, DisplayCondition[]> = {};
  for (const condition of displayConditions) {
    const group = condition.group ?? "";
    if (!groups[group]) groups[group] = [];
    groups[group].push(condition);
  }
  return groups;
});

function updateStyle(field: string, value: unknown): void {
  emit("update", {
    styles: { ...props.block.styles, [field]: value },
  });
}

function isVisible(key: VisibilityKey): boolean {
  return props.block.visibility?.[key] !== false;
}

function toggleVisibility(key: VisibilityKey): void {
  const next: Record<VisibilityKey, boolean> = {
    desktop: isVisible("desktop"),
    tablet: isVisible("tablet"),
    mobile: isVisible("mobile"),
  };
  next[key] = !next[key];
  emit("update", { visibility: next });
}
</script>

<template>
  <div class="tpl:flex tpl:flex-col" :class="isFirstSection ? '' : 'tpl:mt-4'">
    <CollapsibleSection
      :title="t.blockSettings.spacing"
      :open="openSections.has('spacing')"
      :no-border="isFirstSection"
      @toggle="toggleSection('spacing')"
    >
      <SpacingControl
        :label="t.blockSettings.padding"
        :model-value="block.styles.padding"
        @update:model-value="updateStyle('padding', $event)"
      />
      <div class="tpl:mt-4">
        <SpacingControl
          :label="t.blockSettings.margin"
          :model-value="block.styles.margin"
          @update:model-value="updateStyle('margin', $event)"
        />
      </div>
    </CollapsibleSection>

    <CollapsibleSection
      :title="t.blockSettings.background"
      :open="openSections.has('bg')"
      @toggle="toggleSection('bg')"
    >
      <label :class="labelClass">{{ t.blockSettings.color }}</label>
      <ColorPicker
        size="large"
        :model-value="block.styles.backgroundColor || DEFAULT_BG_COLOR"
        @update:model-value="updateStyle('backgroundColor', $event)"
      />
    </CollapsibleSection>

    <CollapsibleSection
      :title="t.blockSettings.display"
      :open="openSections.has('display')"
      @toggle="toggleSection('display')"
    >
      <div class="tpl:space-y-2">
        <label
          v-for="item in VISIBILITY_ITEMS"
          :key="item.key"
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
        >
          <input
            type="checkbox"
            class="tpl:accent-[var(--tpl-primary)]"
            :checked="isVisible(item.key)"
            @change="toggleVisibility(item.key)"
          />
          <component :is="item.icon" :size="14" :stroke-width="1.5" />
          {{ t.blockSettings[item.labelKey] }}
        </label>
      </div>
    </CollapsibleSection>

    <CollapsibleSection
      :title="t.blockSettings.customCss"
      :open="openSections.has('css')"
      @toggle="toggleSection('css')"
    >
      <label :class="labelClass">{{ t.blockSettings.css }}</label>
      <textarea
        :value="block.customCss || ''"
        :placeholder="t.blockSettings.cssPlaceholder"
        rows="3"
        :class="monoTextareaClass"
        @input="
          emit('update', {
            customCss: ($event.target as HTMLTextAreaElement).value,
          })
        "
      />
    </CollapsibleSection>

    <CollapsibleSection
      v-if="hasDisplayConditions"
      :title="t.blockSettings.displayCondition"
      :open="openSections.has('condition')"
      @toggle="toggleSection('condition')"
    >
      <div class="tpl:space-y-2">
        <select
          class="tpl:w-full tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:text-xs tpl:outline-none tpl:transition-all tpl:duration-150 tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
          :class="
            block.displayCondition
              ? 'tpl:border-[var(--tpl-primary)] tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-text)]'
              : 'tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]'
          "
          :value="
            customConditionMode || isCustomCondition
              ? '__custom__'
              : (block.displayCondition?.label ?? '')
          "
          @change="
            (e: Event) => {
              const label = (e.target as HTMLSelectElement).value;
              if (label === '__custom__') {
                startCustomCondition();
                return;
              }
              customConditionMode = false;
              if (!label) {
                emit('update', { displayCondition: undefined });
                return;
              }
              const condition = displayConditions.find(
                (c) => c.label === label,
              );
              if (condition) {
                emit('update', { displayCondition: condition });
              }
            }
          "
        >
          <option value="">{{ t.blockSettings.noCondition }}</option>
          <template
            v-for="(conditions, group) in groupedDisplayConditions"
            :key="group"
          >
            <optgroup v-if="group" :label="String(group)">
              <option
                v-for="condition in conditions"
                :key="condition.label"
                :value="condition.label"
              >
                {{ condition.label }}
              </option>
            </optgroup>
            <template v-else>
              <option
                v-for="condition in conditions"
                :key="condition.label"
                :value="condition.label"
              >
                {{ condition.label }}
              </option>
            </template>
          </template>
          <option v-if="allowCustomConditions" value="__custom__">
            {{ t.blockSettings.customCondition }}
          </option>
        </select>

        <template v-if="customConditionMode || isCustomCondition">
          <div class="tpl:space-y-2">
            <div>
              <label
                class="tpl:mb-1 tpl:block tpl:text-[11px] tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
                >{{ t.blockSettings.customConditionBefore }}</label
              >
              <textarea
                v-model="customBefore"
                rows="2"
                :class="monoTextareaClass"
              />
            </div>
            <div>
              <label
                class="tpl:mb-1 tpl:block tpl:text-[11px] tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
                >{{ t.blockSettings.customConditionAfter }}</label
              >
              <textarea
                v-model="customAfter"
                rows="2"
                :class="monoTextareaClass"
              />
            </div>
            <div class="tpl:flex tpl:justify-end">
              <button
                type="button"
                class="tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-[var(--tpl-primary)] tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-bg)] tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:opacity-50"
                :disabled="!customBefore.trim()"
                @click="applyCustomCondition"
              >
                {{ t.blockSettings.applyCondition }}
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="block.displayCondition && !isCustomCondition">
          <p
            v-if="block.displayCondition.description"
            class="tpl:text-[11px] tpl:text-[var(--tpl-text-muted)]"
          >
            {{ block.displayCondition.description }}
          </p>
          <div class="tpl:space-y-1">
            <pre
              class="tpl:m-0 tpl:overflow-x-auto tpl:rounded tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
              >{{ block.displayCondition.before }}</pre
            >
            <pre
              v-if="block.displayCondition.after"
              class="tpl:m-0 tpl:overflow-x-auto tpl:rounded tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
              >{{ block.displayCondition.after }}</pre
            >
          </div>
        </template>
      </div>
    </CollapsibleSection>
  </div>
</template>
