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
  monoTextareaClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "../../constants/styleConstants";
import {
  resolveHero,
  type BackgroundImage,
  safeClone,
  type Block,
  type DisplayCondition,
  type SectionWrapper,
} from "@templatical/types";
import { Monitor, Smartphone } from "@lucide/vue";
import {
  computed,
  inject,
  reactive,
  ref,
  toRaw,
  watch,
  type Component,
} from "vue";
import { useAliveFlag } from "../../composables/useAliveFlag";
import { logger } from "../../utils/logger";
import {
  DISPLAY_CONDITIONS_KEY,
  ALLOW_CUSTOM_CONDITIONS_KEY,
  EDITOR_KEY,
  LAYOUT_KEY,
  LOCALIZATION_KEY,
  SECTION_WRAPPER_KEY,
  ON_REQUEST_DISPLAY_CONDITION_KEY,
} from "../../keys";
import {
  applySectionFullWidth,
  sectionFullWidthDisabled,
} from "../../utils/sectionFullWidth";

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
const layout = inject(LAYOUT_KEY, undefined);
const sectionWrapperEnabled = inject(SECTION_WRAPPER_KEY, undefined);

const showsFullWidth = computed(
  () => props.block.type === "section" || props.block.type === "wrapper",
);
const fullWidthOn = computed(() => {
  if (props.block.type === "wrapper") return props.block.fullWidth === true;
  return (
    props.block.type === "section" && props.block.wrapper?.fullWidth === true
  );
});
const fullWidthDisabled = computed(
  () =>
    props.block.type === "section" &&
    sectionFullWidthDisabled(props.block, {
      sectionWrapper: sectionWrapperEnabled,
      layout,
    }),
);
const fullWidthTestId = computed(() =>
  props.block.type === "wrapper"
    ? "layout-wrapper-full-width"
    : "section-background-full-width",
);

function setFullWidth(enabled: boolean): void {
  if (props.block.type === "wrapper") {
    emit("update", { fullWidth: enabled });
    return;
  }
  if (props.block.type === "section") {
    emit("update", applySectionFullWidth(props.block, enabled));
  }
}

// While a section's full-width band is on, colour and image edit that band
// (`wrapper`), one partial per change. The section fill is the content
// background over the band, empty meaning transparent.
const editsFullWidthBand = computed(
  () =>
    props.block.type === "section" && props.block.wrapper?.fullWidth === true,
);
const backgroundColorPath = computed(() =>
  editsFullWidthBand.value
    ? "wrapper.backgroundColor"
    : "styles.backgroundColor",
);
const backgroundImagePath = computed(() =>
  editsFullWidthBand.value ? "wrapper.backgroundImage" : "backgroundImage",
);
const backgroundColorValue = computed(() => {
  const block = props.block;
  if (block.type === "section" && block.wrapper?.fullWidth === true) {
    return block.wrapper.backgroundColor ?? "";
  }
  return block.styles.backgroundColor ?? "";
});
const backgroundImageValue = computed(() => {
  const block = props.block;
  if (block.type === "section" && block.wrapper?.fullWidth === true) {
    return block.wrapper.backgroundImage;
  }
  return block.type === "section" ? block.backgroundImage : undefined;
});

function updateWrapper(
  wrapper: SectionWrapper,
  patch: Partial<SectionWrapper>,
): void {
  emit("update", { wrapper: { ...wrapper, ...patch } });
}

function setBackgroundColor(value: string): void {
  const block = props.block;
  if (block.type === "section" && block.wrapper?.fullWidth === true) {
    updateWrapper(block.wrapper, { backgroundColor: value });
    return;
  }
  updateStyle("backgroundColor", value);
}

function setBackgroundImage(image: BackgroundImage | undefined): void {
  const block = props.block;
  if (block.type === "section" && block.wrapper?.fullWidth === true) {
    updateWrapper(block.wrapper, { backgroundImage: image });
    return;
  }
  emit("update", { backgroundImage: image });
}
const onRequest = inject(ON_REQUEST_DISPLAY_CONDITION_KEY, null);
const aliveFlag = useAliveFlag();
const requesting = ref(false);

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
  () => !!onRequest || displayConditions.length > 0 || allowCustomConditions,
);

function isDisplayCondition(value: unknown): value is DisplayCondition {
  // An array is an object, so named label/before/after on it would pass a typeof check.
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.label === "string" &&
    typeof record.before === "string" &&
    typeof record.after === "string"
  );
}

function writeCondition(
  blockId: string,
  displayCondition: DisplayCondition | undefined,
): void {
  // Props flush after selectedBlockId. The toolbar emit is applied to whatever
  // is selected at that moment, so a same-turn selection change (insertBlock
  // selects synchronously) must take the id-targeted path while props are stale.
  const selectedId = editor?.state?.selectedBlockId;
  if (
    props.block.id === blockId &&
    (selectedId === undefined || selectedId === blockId)
  ) {
    emit("update", { displayCondition });
    return;
  }
  if (!editor || !editor.findBlockLocation(blockId)) return;
  editor.updateBlock(blockId, { displayCondition });
}

async function requestDisplayCondition(): Promise<void> {
  if (!onRequest || requesting.value) return;
  const blockId = props.block.id;
  // updateBlock stores this field on the active language's layer. A switch
  // during the request would write that layer instead of the one the user opened.
  const localeAtStart = editor?.activeLocale?.value ?? null;
  const block = safeClone(toRaw(props.block));
  const current = props.block.displayCondition
    ? safeClone(toRaw(props.block.displayCondition))
    : undefined;
  requesting.value = true;
  try {
    const result = await onRequest(current ? { current, block } : { block });
    if (!aliveFlag.alive) return;
    if ((editor?.activeLocale?.value ?? null) !== localeAtStart) return;
    if (result === null) return;
    if (!isDisplayCondition(result)) {
      logger.warn(
        "displayConditions.onRequest resolved a value without string label, before and after — ignoring it.",
      );
      return;
    }
    // Copy so a later host mutation, including nested data, cannot reach editor state.
    writeCondition(blockId, safeClone(result));
  } finally {
    if (aliveFlag.alive) requesting.value = false;
  }
}

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
  const before = customBefore.value.trim();
  const after = customAfter.value.trim();
  if (!before) return;
  emit("update", {
    displayCondition: {
      label: t.blockSettings.customCondition,
      before,
      after,
    },
  });
  customConditionMode.value = false;
  customBefore.value = before;
  customAfter.value = after;
}

watch(
  [
    () => editor?.state?.template?.id,
    () => props.block.id,
    () => props.block.displayCondition?.label,
    () => props.block.displayCondition?.before,
    () => props.block.displayCondition?.after,
  ],
  () => {
    const condition = props.block.displayCondition;
    if (!condition || !isCustomCondition.value) {
      customConditionMode.value = false;
      customBefore.value = "";
      customAfter.value = "";
      return;
    }
    customBefore.value = condition.before;
    customAfter.value = condition.after ?? "";
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
      <SpacingControl
        path="styles.padding"
        :label="t.blockSettings.padding"
        :model-value="block.styles.padding"
        @update:model-value="updateStyle('padding', $event)"
      />
    </CollapsibleSection>

    <CollapsibleSection
      :title="t.blockSettings.background"
      :open="openSections.has('bg')"
      header-test-id="block-settings-background"
      @toggle="toggleSection('bg')"
    >
      <FieldRow :path="backgroundColorPath" :label="t.blockSettings.color"
        ><ColorPicker
          :model-value="backgroundColorValue"
          allow-transparent
          @update:model-value="setBackgroundColor"
      /></FieldRow>
      <FieldRow
        v-if="showsFullWidth"
        :path="block.type === 'section' ? 'wrapper.fullWidth' : 'fullWidth'"
        :label="t.blockSettings.fullWidthBackground"
        ><template #label-actions="{ controlId }"
          ><ToggleSwitch
            :data-testid="fullWidthTestId"
            :control-id="controlId"
            hide-label
            class="tpl:text-xs tpl:text-[var(--tpl-text)]"
            :model-value="fullWidthOn"
            :disabled="fullWidthDisabled"
            :label="t.blockSettings.fullWidthBackground"
            @update:model-value="setFullWidth" /></template
      ></FieldRow>
      <!-- Only sections take an image here: MJML has no background-url on
           columns or content elements. -->
      <FieldRow
        v-if="block.type === 'section'"
        :path="backgroundImagePath"
        :label="t.blockSettings.backgroundImage"
        ><BackgroundImageControl
          hide-label
          class="tpl:mt-3.5"
          :model-value="backgroundImageValue"
          testid-prefix="section"
          measure
          :hero-mode="heroApplied"
          @update:model-value="setBackgroundImage"
      /></FieldRow>
      <FieldRow
        v-if="editsFullWidthBand"
        path="styles.backgroundColor"
        :label="t.blockSettings.contentBackground"
        ><ColorPicker
          data-testid="section-content-background"
          :model-value="block.styles.backgroundColor ?? ''"
          allow-transparent
          @update:model-value="updateStyle('backgroundColor', $event)"
      /></FieldRow>
      <FieldRow
        v-if="block.type === 'section'"
        path="hero"
        :label="t.blocks.hero"
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
          :label="t.blockSettings[item.labelKey]"
          ><template #label
            ><span class="tpl:flex tpl:items-center tpl:gap-2">
              <component :is="item.icon" :size="14" :stroke-width="1.5" />
              {{ t.blockSettings[item.labelKey] }}
            </span></template
          ><template #label-actions="{ controlId }"
            ><ToggleSwitch
              :control-id="controlId"
              hide-label
              class="tpl:text-xs tpl:text-[var(--tpl-text)]"
              :model-value="isVisible(item.key)"
              :label="t.blockSettings[item.labelKey]"
              @update:model-value="toggleVisibility(item.key)"
            ></ToggleSwitch></template
        ></FieldRow>
      </div>
    </CollapsibleSection>

    <CollapsibleSection
      v-if="hasDisplayConditions"
      header-test-id="display-condition-section"
      :title="t.blockSettings.displayCondition"
      :open="openSections.has('condition')"
      @toggle="toggleSection('condition')"
    >
      <div v-if="onRequest" class="tpl:space-y-2">
        <template v-if="block.displayCondition">
          <p class="tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]">
            {{ block.displayCondition.label }}
          </p>
          <p
            v-if="block.displayCondition.description"
            class="tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
          >
            {{ block.displayCondition.description }}
          </p>
          <div class="tpl:flex tpl:gap-2">
            <button
              type="button"
              data-testid="display-condition-edit"
              :class="secondaryBtnClass"
              :disabled="requesting"
              @click="requestDisplayCondition"
            >
              {{ t.blockSettings.editCondition }}
            </button>
            <button
              type="button"
              data-testid="display-condition-remove"
              :class="secondaryBtnClass"
              :disabled="requesting"
              @click="emit('update', { displayCondition: undefined })"
            >
              {{ t.blockSettings.removeCondition }}
            </button>
          </div>
        </template>
        <button
          v-else
          type="button"
          data-testid="display-condition-request"
          :class="secondaryBtnClass"
          :disabled="requesting"
          @click="requestDisplayCondition"
        >
          {{ t.blockSettings.addCondition }}
        </button>
      </div>
      <div v-else class="tpl:space-y-2">
        <FieldRow
          path="displayCondition"
          :label="t.blockSettings.displayCondition"
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
