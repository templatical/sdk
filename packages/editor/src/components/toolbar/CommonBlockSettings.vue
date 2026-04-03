<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SpacingControl from "../SpacingControl.vue";
import { useI18n } from "../../composables/useI18n";
import { labelClass } from "../../constants/styleConstants";
import type { Block, DisplayCondition } from "@templatical/types";
import { ChevronDown, Monitor, Smartphone, Tablet } from "@lucide/vue";
import { computed, inject, ref, watch } from "vue";

const props = defineProps<{
  block: Block;
  isFirstSection?: boolean;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<Block>): void;
}>();

const { t } = useI18n();

const displayConditions = inject<DisplayCondition[]>("displayConditions", []);
const allowCustomConditions = inject<boolean>("allowCustomConditions", false);

const spacingOpen = ref(false);
const bgOpen = ref(false);
const displayOpen = ref(false);
const cssOpen = ref(false);
const conditionOpen = ref(false);

const hasDisplayConditions = computed(
  () => displayConditions.length > 0 || allowCustomConditions,
);

const customConditionMode = ref(false);
const customBefore = ref("");
const customAfter = ref("");

const isCustomCondition = computed(() => {
  if (!props.block.displayCondition) {
    return false;
  }
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
  if (!customBefore.value.trim()) {
    return;
  }
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
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(condition);
  }
  return groups;
});

function updateStyle(field: string, value: unknown): void {
  emit("update", {
    styles: {
      ...props.block.styles,
      [field]: value,
    },
  });
}
</script>

<template>
  <div class="tpl:flex tpl:flex-col" :class="isFirstSection ? '' : 'tpl:mt-4'">
    <!-- Spacing -->
    <div
      class="tpl:py-3"
      :class="
        isFirstSection ? '' : 'tpl:border-t tpl:border-[var(--tpl-border)]'
      "
    >
      <button
        type="button"
        class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        @click="spacingOpen = !spacingOpen"
      >
        <ChevronDown
          class="tpl:transition-transform tpl:duration-200"
          :class="spacingOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
          :size="12"
          :stroke-width="2"
        />
        <span>{{ t.blockSettings.spacing }}</span>
      </button>
      <div v-show="spacingOpen" class="tpl:mt-3">
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
      </div>
    </div>

    <!-- Background -->
    <div class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3">
      <button
        type="button"
        class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        @click="bgOpen = !bgOpen"
      >
        <ChevronDown
          class="tpl:transition-transform tpl:duration-200"
          :class="bgOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
          :size="12"
          :stroke-width="2"
        />
        <span>{{ t.blockSettings.background }}</span>
      </button>
      <div v-show="bgOpen" class="tpl:mt-3">
        <label :class="labelClass">{{ t.blockSettings.color }}</label>
        <ColorPicker
          size="large"
          :model-value="block.styles.backgroundColor || '#ffffff'"
          @update:model-value="updateStyle('backgroundColor', $event)"
        />
      </div>
    </div>

    <!-- Display -->
    <div class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3">
      <button
        type="button"
        class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        @click="displayOpen = !displayOpen"
      >
        <ChevronDown
          class="tpl:transition-transform tpl:duration-200"
          :class="displayOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
          :size="12"
          :stroke-width="2"
        />
        <span>{{ t.blockSettings.display }}</span>
      </button>
      <div v-show="displayOpen" class="tpl:mt-3 tpl:space-y-2">
        <label
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
        >
          <input
            type="checkbox"
            class="tpl:accent-[var(--tpl-primary)]"
            :checked="block.visibility?.desktop !== false"
            @change="
              emit('update', {
                visibility: {
                  desktop: block.visibility?.desktop !== false ? false : true,
                  tablet: block.visibility?.tablet !== false,
                  mobile: block.visibility?.mobile !== false,
                },
              })
            "
          />
          <Monitor :size="14" :stroke-width="1.5" />
          {{ t.blockSettings.showOnDesktop }}
        </label>
        <label
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
        >
          <input
            type="checkbox"
            class="tpl:accent-[var(--tpl-primary)]"
            :checked="block.visibility?.tablet !== false"
            @change="
              emit('update', {
                visibility: {
                  desktop: block.visibility?.desktop !== false,
                  tablet: block.visibility?.tablet !== false ? false : true,
                  mobile: block.visibility?.mobile !== false,
                },
              })
            "
          />
          <Tablet :size="14" :stroke-width="1.5" />
          {{ t.blockSettings.showOnTablet }}
        </label>
        <label
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
        >
          <input
            type="checkbox"
            class="tpl:accent-[var(--tpl-primary)]"
            :checked="block.visibility?.mobile !== false"
            @change="
              emit('update', {
                visibility: {
                  desktop: block.visibility?.desktop !== false,
                  tablet: block.visibility?.tablet !== false,
                  mobile: block.visibility?.mobile !== false ? false : true,
                },
              })
            "
          />
          <Smartphone :size="14" :stroke-width="1.5" />
          {{ t.blockSettings.showOnMobile }}
        </label>
      </div>
    </div>

    <!-- Custom CSS -->
    <div class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3">
      <button
        type="button"
        class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        @click="cssOpen = !cssOpen"
      >
        <ChevronDown
          class="tpl:transition-transform tpl:duration-200"
          :class="cssOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
          :size="12"
          :stroke-width="2"
        />
        <span>{{ t.blockSettings.customCss }}</span>
      </button>
      <div v-show="cssOpen" class="tpl:mt-3">
        <label :class="labelClass">{{ t.blockSettings.css }}</label>
        <textarea
          :value="block.customCss || ''"
          :placeholder="t.blockSettings.cssPlaceholder"
          rows="3"
          class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:outline-none tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
          @input="
            emit('update', {
              customCss: ($event.target as HTMLTextAreaElement).value,
            })
          "
        />
      </div>
    </div>

    <!-- Display Conditions -->
    <div
      v-if="hasDisplayConditions"
      class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3"
    >
      <button
        type="button"
        class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        @click="conditionOpen = !conditionOpen"
      >
        <ChevronDown
          class="tpl:transition-transform tpl:duration-200"
          :class="conditionOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
          :size="12"
          :stroke-width="2"
        />
        <span>{{ t.blockSettings.displayCondition }}</span>
      </button>
      <div v-show="conditionOpen" class="tpl:mt-3 tpl:space-y-2">
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

        <!-- Custom condition fields -->
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
                class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none tpl:transition-all tpl:duration-150 tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
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
                class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none tpl:transition-all tpl:duration-150 tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
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

        <!-- Preset condition details -->
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
    </div>
  </div>
</template>
