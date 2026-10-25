<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import { languageName } from "../../utils/languageName";
import ColorPicker from "../ColorPicker.vue";
import SpacingControl from "../SpacingControl.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import BackgroundImageControl from "./BackgroundImageControl.vue";
import CollapsibleSection from "./CollapsibleSection.vue";
import HeroControl from "./HeroControl.vue";
import { useI18n } from "../../composables/useI18n";
import {
  labelClass,
  monoTextareaClass,
  primaryBtnClass,
} from "../../constants/styleConstants";
import {
  resolveHero,
  type Block,
  type DisplayCondition,
} from "@templatical/types";
import { Monitor, Smartphone } from "@lucide/vue";
import { computed, inject, reactive, ref, watch, type Component } from "vue";
import {
  DISPLAY_CONDITIONS_KEY,
  ALLOW_CUSTOM_CONDITIONS_KEY,
  EDITOR_KEY,
  LOCALIZATION_KEY,
} from "../../keys";

type SectionKey = "spacing" | "bg" | "display" | "condition";
type VisibilityKey = "desktop" | "mobile";

const props = defineProps<{
  block: Block;
  isFirstSection?: boolean;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<Block>): void;
}>();

const { t, format } = useI18n();
const editor = inject(EDITOR_KEY, null);
const localization = inject(LOCALIZATION_KEY, undefined);
const activeLocale = computed(() => editor?.activeLocale?.value);
const localeHidden = computed(
  () =>
    !!(
      activeLocale.value &&
      editor?.selectedBlock?.value?.l10n?.[activeLocale.value]?.hidden
    ),
);

const displayConditions = inject(DISPLAY_CONDITIONS_KEY, []);
const allowCustomConditions = inject(ALLOW_CUSTOM_CONDITIONS_KEY, false);

const openSections = reactive(new Set<SectionKey>());
const customConditionMode = ref(false);
const customBefore = ref("");
const customAfter = ref("");

const VISIBILITY_ITEMS: {
  key: VisibilityKey;
  icon: Component;
  labelKey: "showOnDesktop" | "showOnMobile";
}[] = [
  { key: "desktop", icon: Monitor, labelKey: "showOnDesktop" },
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

// A hero paints its image cover and unrepeated, so those controls hide while it applies.
const heroApplied = computed(
  () =>
    props.block.type === "section" &&
    resolveHero(props.block)?.applied === true,
);

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
      <FieldRow path="styles.padding"
        ><SpacingControl
          :label="t.blockSettings.padding"
          :model-value="block.styles.padding"
          @update:model-value="updateStyle('padding', $event)"
      /></FieldRow>
    </CollapsibleSection>

    <CollapsibleSection
      :title="t.blockSettings.background"
      :open="openSections.has('bg')"
      header-test-id="block-settings-background"
      @toggle="toggleSection('bg')"
    >
      <label :class="labelClass">{{ t.blockSettings.color }}</label>
      <FieldRow path="styles.backgroundColor"
        ><ColorPicker
          :model-value="block.styles.backgroundColor ?? ''"
          allow-transparent
          @update:model-value="updateStyle('backgroundColor', $event)"
      /></FieldRow>
      <!-- Only sections take an image here: MJML has no background-url on
           columns or content elements. -->
      <FieldRow v-if="block.type === 'section'" path="backgroundImage"
        ><BackgroundImageControl
          class="tpl:mt-3.5"
          :model-value="block.backgroundImage"
          testid-prefix="section"
          measure
          :hero-mode="heroApplied"
          @update:model-value="emit('update', { backgroundImage: $event })"
      /></FieldRow>
      <FieldRow v-if="block.type === 'section'" path="hero"
        ><HeroControl :section="block" @update="emit('update', $event)"
      /></FieldRow>
    </CollapsibleSection>

    <CollapsibleSection
      :title="t.blockSettings.display"
      :open="openSections.has('display')"
      @toggle="toggleSection('display')"
    >
      <div class="tpl:space-y-2">
        <ToggleSwitch
          v-if="activeLocale && localization"
          data-testid="locale-hide"
          :disabled="!localization.locales.includes(activeLocale)"
          :model-value="localeHidden"
          :label="
            format(t.localization.hide, {
              language: languageName(activeLocale),
            })
          "
          @update:model-value="editor?.setBlockHidden?.(block.id, $event)"
        />
        <FieldRow
          v-for="item in VISIBILITY_ITEMS"
          :key="item.key"
          :path="`visibility.${item.key}`"
          ><ToggleSwitch
            class="tpl:text-xs tpl:text-[var(--tpl-text)]"
            :model-value="isVisible(item.key)"
            :label="t.blockSettings[item.labelKey]"
            @update:model-value="toggleVisibility(item.key)"
          >
            <span class="tpl:flex tpl:items-center tpl:gap-2">
              <component :is="item.icon" :size="14" :stroke-width="1.5" />
              {{ t.blockSettings[item.labelKey] }}
            </span>
          </ToggleSwitch></FieldRow
        >
      </div>
    </CollapsibleSection>

    <CollapsibleSection
      v-if="hasDisplayConditions"
      header-test-id="display-condition-section"
      :title="t.blockSettings.displayCondition"
      :open="openSections.has('condition')"
      @toggle="toggleSection('condition')"
    >
      <div class="tpl:space-y-2">
        <FieldRow path="displayCondition"
          ><select
            data-testid="display-condition-select"
            class="tpl:w-full tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:text-xs tpl:outline-none tpl:transition-all tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
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
          </select></FieldRow
        >

        <template v-if="customConditionMode || isCustomCondition">
          <div class="tpl:space-y-2">
            <div>
              <label
                class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
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
                class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
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
                :class="primaryBtnClass"
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
            class="tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
          >
            {{ block.displayCondition.description }}
          </p>
          <div class="tpl:space-y-1">
            <pre
              class="tpl:m-0 tpl:overflow-x-auto tpl:rounded tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
              >{{ block.displayCondition.before }}</pre>
            <pre
              v-if="block.displayCondition.after"
              class="tpl:m-0 tpl:overflow-x-auto tpl:rounded tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
              >{{ block.displayCondition.after }}</pre>
          </div>
        </template>
      </div>
    </CollapsibleSection>
  </div>
</template>
