<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import { useLocalizedDisplay } from "../../composables/useLocalizedDisplay";
import MediaDropOverlay from "../MediaDropOverlay.vue";
import MergeTagInput from "../MergeTagInput.vue";
import BorderControl from "./BorderControl.vue";
import LinkToggle from "./LinkToggle.vue";
import RadiusControl from "./RadiusControl.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
} from "../../constants/styleConstants";
import type {
  BorderRadiusValue,
  ImageBlock,
  MediaResult,
} from "@templatical/types";
import {
  containsMergeTag,
  SYNTAX_PRESETS,
  toBorderRadiusCss,
} from "@templatical/types";
import { Image } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { EDITOR_KEY, LAYOUT_KEY, MERGE_TAG_SYNTAX_KEY } from "../../keys";
import { useMediaDropField } from "../../composables/useMediaDropField";
import { useImageAspectLock } from "../../composables/useImageAspectLock";
import { useResolvedImageSrc } from "../../composables/useImageUrlResolver";
import { useNaturalImageSize } from "../../composables/useNaturalImageSize";
import { imageRoom } from "../../utils/imageRoom";
import {
  naturalSizeFields,
  naturalSizeOf,
  toNaturalSize,
} from "../../utils/imageNaturalSize";
import { useTimeoutFn } from "@vueuse/core";

const props = defineProps<{
  block: ImageBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ImageBlock>): void;
}>();

const { t, format } = useI18n();
const mergeTagSyntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
const editor = inject(EDITOR_KEY, null);
const localized = editor ? useLocalizedDisplay(editor) : null;
const layout = inject(LAYOUT_KEY, undefined);

const pulseSrc = ref(false);
const pulseAlt = ref(false);

// The pulse plays when its class goes on, so both flags come off again for
// the next pick to pulse.
const { start: startPulse } = useTimeoutFn(
  () => {
    pulseSrc.value = false;
    pulseAlt.value = false;
  },
  1000,
  { immediate: false },
);

const WIDTH_PRESETS = [300, 400, 500];
const DEFAULT_CUSTOM_WIDTH = 350;
const DEFAULT_CUSTOM_HEIGHT = 200;

const widthMode = computed(() => {
  const w = props.block.width;
  if (w === "full") return "full";
  if (WIDTH_PRESETS.includes(w)) return String(w);
  return "custom";
});

const heightMode = computed(() =>
  typeof props.block.height === "number" ? "custom" : "auto",
);

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<ImageBlock>);
}

function updateWidthMode(value: string): void {
  if (value === "custom") {
    const w = props.block.width;
    if (typeof w !== "number" || WIDTH_PRESETS.includes(w)) {
      emit("update", aspectLock.widthUpdates(DEFAULT_CUSTOM_WIDTH));
    }
    return;
  }
  emit(
    "update",
    aspectLock.widthUpdates(value === "full" ? "full" : Number(value)),
  );
}

function updateHeightMode(value: string): void {
  updateField("height", value === "custom" ? DEFAULT_CUSTOM_HEIGHT : undefined);
}

function updateCustomHeight(raw: string): void {
  // Same guard as the custom width below: an empty number field yields
  // Number("") === 0, which would collapse the image to nothing. Absent means
  // "keep the aspect ratio", so an invalid value must not overwrite the last
  // valid height either.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  updateField("height", n);
}

function updateBorderRadius(value: BorderRadiusValue): void {
  // Here 0 is a real answer (square), so an emptied field clears the radius
  // rather than keeping the old one. `RadiusControl` ignores negatives, and
  // `NumberWithSuffix` withholds the in-progress "-".
  //
  // Absent, not 0: both render as square corners, but a stored 0 travels in
  // every exported template as though the author had chosen it. Matches
  // `createImageBlock`, and `updateHeightMode` above clears the same way.
  // All-square corners clear the same way.
  updateField(
    "borderRadius",
    toBorderRadiusCss(value) === null ? undefined : value,
  );
}

function updateCustomWidth(raw: string): void {
  // Guard against empty / NaN / non-positive input. An empty number field
  // yields Number("") === 0, which would emit width: 0 and render an
  // invisible image (#259). Ignore invalid values and keep the last valid
  // width; the canvas still updates live on each valid keystroke.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  emit("update", aspectLock.widthUpdates(n));
}

/**
 * A new `src` carries its file's size, or clears the old one, so a ratio
 * from the previous file never drives the lock.
 */
function updateSrc(value: string): void {
  if (value === props.block.src) return;
  emit("update", { src: value, ...naturalSizeFields(null) });
}

function applyMedia(result: MediaResult): void {
  emit("update", {
    src: result.url,
    ...naturalSizeFields(toNaturalSize(result.width, result.height)),
  });
  if (result.alt) {
    updateField("alt", result.alt);
    pulseAlt.value = true;
  }
  pulseSrc.value = true;
  startPulse();
}

const dropZoneRef = ref<HTMLElement>();
// A merge-tag src is a deliberate dynamic value — never clobber it via drop.
const hasMergeTagSrc = computed(() =>
  containsMergeTag(props.block.src, mergeTagSyntax),
);
const { canBrowse, isUploading, showOverlay, openMediaBrowser } =
  useMediaDropField({
    target: dropZoneRef,
    blocked: hasMergeTagSrc,
    apply: applyMedia,
  });

// Measured only when the block stores no size, and never for a merge-tag
// `src`, which names no file. The resolved URL is the one the canvas shows.
const displaySrc = useResolvedImageSrc(() =>
  hasMergeTagSrc.value || !props.block.src || naturalSizeOf(props.block)
    ? undefined
    : props.block.src,
);
const measuredSize = useNaturalImageSize(() => displaySrc.value);
const room = computed(() =>
  localized ? imageRoom(localized.content.value, props.block.id, layout) : null,
);
const aspectLock = useImageAspectLock({
  block: () => props.block,
  room: () => room.value,
  measured: () => measuredSize.value,
});
const {
  available: aspectLockAvailable,
  locked: aspectLocked,
  derivedHeight,
  cappedHeight,
} = aspectLock;

function toggleAspectLock(): void {
  const updates = aspectLock.setLocked(!aspectLocked.value);
  if (updates) emit("update", updates);
}

// What the locked height field shows while it has focus: the typed value,
// even when the width it gives is capped at the column.
const lockedHeightDraft = ref<string | null>(null);

function updateLockedHeight(raw: string): void {
  lockedHeightDraft.value = raw;
  const updates = aspectLock.heightUpdates(Number(raw));
  if (updates) emit("update", updates);
}
</script>

<template>
  <FieldRow :label="t.image.imageUrl" class="tpl:mb-3.5" path="src">
    <div ref="dropZoneRef" class="tpl:relative">
      <MediaDropOverlay v-if="showOverlay" :uploading="isUploading" />
      <MergeTagInput
        :model-value="block.src"
        type="url"
        :placeholder="t.image.imageUrlPlaceholder"
        :pulse="pulseSrc"
        @update:model-value="updateSrc($event)"
      />
      <button
        v-if="canBrowse"
        class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all"
        style="
          border-color: var(--tpl-border);
          color: var(--tpl-primary);
          background-color: var(--tpl-bg);
        "
        @click="openMediaBrowser"
      >
        <Image :size="14" :stroke-width="1.5" />
        {{ t.image.browseMedia }}
      </button>
    </div>
  </FieldRow>
  <FieldRow
    v-if="containsMergeTag(block.src, mergeTagSyntax)"
    class="tpl:mb-3.5"
    path="placeholderUrl"
  >
    <template #label
      >{{ t.image.placeholderUrl }}
      <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">
        {{ t.image.optional }}
      </span>
    </template>
    <input
      type="url"
      :class="inputClass"
      :value="block.placeholderUrl || ''"
      :placeholder="t.image.placeholderUrlPlaceholder"
      :title="t.image.placeholderUrlTooltip"
      @input="
        updateField('placeholderUrl', ($event.target as HTMLInputElement).value)
      "
    />
  </FieldRow>
  <FieldRow :label="t.image.altText" class="tpl:mb-3.5" path="alt">
    <MergeTagInput
      :model-value="block.alt"
      type="text"
      :placeholder="t.image.altTextPlaceholder"
      :pulse="pulseAlt"
      :disabled="block.decorative === true"
      @update:model-value="updateField('alt', $event)"
    />
    <FieldRow path="decorative" :label="t.image.decorative"
      ><template #label
        ><span>
          {{ t.image.decorative }}
          <span class="tpl:block tpl:text-[var(--tpl-text-dim)]">
            {{ t.image.decorativeHint }}
          </span>
        </span></template
      ><template #label-actions="{ controlId }"
        ><ToggleSwitch
          :control-id="controlId"
          hide-label
          class="tpl:mt-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
          :model-value="block.decorative === true"
          :label="t.image.decorative"
          @update:model-value="updateField('decorative', $event)"
        ></ToggleSwitch></template
    ></FieldRow>
  </FieldRow>
  <FieldRow :label="t.image.width" class="tpl:mb-3.5" path="width">
    <select
      :class="inputClass"
      data-testid="image-width-mode"
      :value="widthMode"
      @change="updateWidthMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="full">{{ t.image.fullWidth }}</option>
      <option value="300">300px</option>
      <option value="400">400px</option>
      <option value="500">500px</option>
      <option value="custom">{{ t.image.widthCustom }}</option>
    </select>
    <div
      v-if="widthMode === 'custom'"
      class="tpl:mt-2 tpl:flex tpl:items-stretch"
    >
      <input
        type="number"
        data-testid="image-width-input"
        :class="inputGroupInputClass"
        :value="
          typeof block.width === 'number' ? block.width : DEFAULT_CUSTOM_WIDTH
        "
        min="20"
        @input="updateCustomWidth(($event.target as HTMLInputElement).value)"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </FieldRow>
  <FieldRow class="tpl:mb-3.5" path="height" :label="t.image.height">
    <template v-if="aspectLockAvailable" #label-actions>
      <LinkToggle
        :linked="aspectLocked"
        :link-label="t.image.lockAspectRatio"
        :unlink-label="t.image.unlockAspectRatio"
        testid="image-aspect-lock"
        @toggle="toggleAspectLock"
      />
    </template>
    <template v-if="aspectLocked">
      <div class="tpl:flex tpl:items-stretch">
        <input
          type="number"
          data-testid="image-locked-height-input"
          :class="inputGroupInputClass"
          :value="lockedHeightDraft ?? derivedHeight ?? ''"
          min="1"
          @input="updateLockedHeight(($event.target as HTMLInputElement).value)"
          @blur="lockedHeightDraft = null"
        />
        <span :class="inputSuffixClass">px</span>
      </div>
      <p
        v-if="cappedHeight !== null"
        class="tpl:mt-1.5 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
        role="status"
        data-testid="image-height-capped"
      >
        {{ format(t.image.heightCapped, { height: cappedHeight }) }}
      </p>
    </template>
    <select
      v-if="!aspectLocked"
      :class="inputClass"
      data-testid="image-height-mode"
      :value="heightMode"
      @change="updateHeightMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="auto">{{ t.image.heightAuto }}</option>
      <option value="custom">{{ t.image.heightCustom }}</option>
    </select>
    <div
      v-if="!aspectLocked && heightMode === 'custom'"
      class="tpl:mt-2 tpl:flex tpl:items-stretch"
    >
      <input
        type="number"
        data-testid="image-height-input"
        :class="inputGroupInputClass"
        :value="block.height"
        min="20"
        @input="updateCustomHeight(($event.target as HTMLInputElement).value)"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </FieldRow>
  <!-- No `max`: a circle needs a radius of at least half the rendered size,
       which the block cannot know at edit time. -->
  <RadiusControl
    path="borderRadius"
    :model-value="block.borderRadius"
    :label="t.image.borderRadius"
    testid-prefix="image"
    @update:model-value="updateBorderRadius"
  />
  <BorderControl
    path="border"
    :model-value="block.border"
    testid-prefix="image"
    @update:model-value="updateField('border', $event)"
  />
  <FieldRow :label="t.title.align" class="tpl:mb-3.5" path="align">
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft },
        { value: 'center', label: t.title.alignCenter },
        { value: 'right', label: t.title.alignRight },
      ]"
      :model-value="block.align"
      @update:model-value="updateField('align', $event)"
    />
  </FieldRow>
  <FieldRow :label="t.image.linkUrl" class="tpl:mb-3.5" path="linkUrl">
    <MergeTagInput
      :model-value="block.linkUrl || ''"
      type="url"
      :placeholder="t.image.imageUrlPlaceholder"
      @update:model-value="updateField('linkUrl', $event)"
    />
    <FieldRow
      v-if="block.linkUrl"
      path="linkOpenInNewTab"
      :label="t.image.openInNewTab"
      ><template #label-actions="{ controlId }"
        ><ToggleSwitch
          :control-id="controlId"
          hide-label
          class="tpl:mt-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
          :model-value="block.linkOpenInNewTab ?? false"
          :label="t.image.openInNewTab"
          @update:model-value="
            updateField('linkOpenInNewTab', $event)
          " /></template
    ></FieldRow>
  </FieldRow>
</template>
