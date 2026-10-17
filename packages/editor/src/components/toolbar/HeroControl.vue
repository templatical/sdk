<script setup lang="ts">
import NumberWithSuffix from "./NumberWithSuffix.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import { useImageMeasure } from "../../composables/useImageMeasure";
import { labelClass } from "../../constants/styleConstants";
import {
  containsMergeTag,
  imageAspectRatio,
  SYNTAX_PRESETS,
  type HeroVerticalAlign,
  type SectionBlock,
} from "@templatical/types";
import { computed, inject } from "vue";
import { EDITOR_KEY, LAYOUT_KEY, MERGE_TAG_SYNTAX_KEY } from "../../keys";
import { getEmailFrameWidth } from "../../utils/emailFrameWidth";
import { sectionBandWidth } from "../../utils/imageRoom";

type HeightMode = "fit" | "image" | "fixed";

/** A fixed height's starting value when the image's size is unknown. */
const FALLBACK_FIXED_HEIGHT = 300;

const props = defineProps<{
  section: SectionBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<SectionBlock>): void;
}>();

const { t } = useI18n();
const mergeTagSyntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
const editor = inject(EDITOR_KEY, null);
const layout = inject(LAYOUT_KEY, undefined);
const measure = useImageMeasure();

const url = computed(() =>
  typeof props.section.backgroundImage?.url === "string"
    ? props.section.backgroundImage.url
    : "",
);
const hasImage = computed(() => url.value.trim() !== "");
const isMergeTagUrl = computed(() =>
  containsMergeTag(url.value, mergeTagSyntax),
);
const hero = computed(() => props.section.hero);
const oneColumn = computed(() => props.section.columns === "1");

const heightMode = computed<HeightMode>(() => {
  if (!hero.value) return "fit";
  return typeof hero.value.height === "number" ? "fixed" : "image";
});

const fixedHeight = computed(() =>
  typeof hero.value?.height === "number"
    ? hero.value.height
    : FALLBACK_FIXED_HEIGHT,
);

const heightOptions = computed(() => [
  { value: "fit", label: t.blockSettings.heroHeightFit },
  {
    value: "image",
    label: t.blockSettings.heroHeightImage,
    // A merge tag has no image to measure until the email is sent.
    disabled: isMergeTagUrl.value,
  },
  { value: "fixed", label: t.blockSettings.heroHeightFixed },
]);

const alignOptions = computed(() => [
  { value: "top", label: t.blockSettings.heroAlignTop },
  { value: "middle", label: t.blockSettings.heroAlignMiddle },
  { value: "bottom", label: t.blockSettings.heroAlignBottom },
]);

const sizeUnknown = computed(
  () =>
    heightMode.value === "image" &&
    hasImage.value &&
    !isMergeTagUrl.value &&
    imageAspectRatio(props.section.backgroundImage) === null,
);

/**
 * The hero box's width, as the renderer sizes it: the room the layout's
 * wrappers and the section's own wrapper leave the section.
 */
function boxWidth(): number {
  const banded = editor
    ? sectionBandWidth(editor.content.value, props.section.id, layout)
    : null;
  return banded ?? getEmailFrameWidth(editor?.state.content.settings);
}

function setHeightMode(mode: string): void {
  const verticalAlign: HeroVerticalAlign =
    hero.value?.verticalAlign ?? "middle";
  if (mode === "image") {
    // Choosing Match image again keeps the hero but retries a size that was
    // never stored, so a dropped measurement has a way back.
    if (heightMode.value !== "image") {
      emit("update", { hero: { height: "image", verticalAlign } });
    }
    void measureIfUnknown();
    return;
  }
  // Re-choosing the current mode must not reset what the author typed.
  if (mode === heightMode.value) return;
  if (mode === "fit") {
    emit("update", { hero: undefined });
    return;
  }
  // Start where the image ends now, so switching doesn't make the hero jump.
  const ratio = imageAspectRatio(props.section.backgroundImage);
  const height =
    ratio === null ? FALLBACK_FIXED_HEIGHT : Math.round(boxWidth() * ratio);
  emit("update", { hero: { height, verticalAlign } });
}

/** Measure the image a matching hero needs the size of, unless it's known. */
async function measureIfUnknown(): Promise<void> {
  const image = props.section.backgroundImage;
  if (!image || !hasImage.value || isMergeTagUrl.value) return;
  if (imageAspectRatio(image) !== null) return;
  const measuredUrl = image.url;
  const size = await measure(measuredUrl);
  const current = props.section.backgroundImage;
  // The author may have picked another image while this one loaded.
  if (!size || !current || current.url !== measuredUrl) return;
  emit("update", {
    backgroundImage: { ...current, width: size.width, height: size.height },
  });
}

function setFixedHeight(value: number): void {
  if (!hero.value || !Number.isFinite(value) || value < 1) return;
  emit("update", { hero: { ...hero.value, height: Math.round(value) } });
}

function setAlign(value: string): void {
  if (!hero.value) return;
  emit("update", {
    hero: { ...hero.value, verticalAlign: value as HeroVerticalAlign },
  });
}
</script>

<template>
  <p
    v-if="!oneColumn && hero"
    data-testid="section-hero-columns-note"
    class="tpl:mt-3.5 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
  >
    {{ t.section.heroNeedsOneColumn }}
  </p>
  <div
    v-else-if="oneColumn && (hasImage || hero)"
    data-testid="section-hero"
    class="tpl:mt-3.5 tpl:space-y-3.5"
  >
    <div data-testid="section-hero-height">
      <label :class="labelClass">{{ t.blockSettings.heroHeight }}</label>
      <SlidingPillSelect
        :options="heightOptions"
        :model-value="heightMode"
        @update:model-value="setHeightMode"
      />
      <p
        v-if="isMergeTagUrl"
        class="tpl:mt-1.5 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
      >
        {{ t.blockSettings.heroMatchImageMergeTag }}
      </p>
      <p
        v-else-if="sizeUnknown"
        class="tpl:mt-1.5 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
      >
        {{ t.blockSettings.heroSizeUnknown }}
      </p>
    </div>
    <NumberWithSuffix
      v-if="heightMode === 'fixed'"
      :model-value="fixedHeight"
      :min="1"
      suffix="px"
      testid="section-hero-height-px"
      @update:model-value="setFixedHeight"
    />
    <div v-if="hero" data-testid="section-hero-align">
      <label :class="labelClass">{{ t.blockSettings.heroAlign }}</label>
      <SlidingPillSelect
        :options="alignOptions"
        :model-value="hero.verticalAlign"
        @update:model-value="setAlign"
      />
    </div>
  </div>
</template>
