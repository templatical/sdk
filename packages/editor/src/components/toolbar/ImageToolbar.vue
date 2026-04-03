<script setup lang="ts">
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import { inputClass, labelClass } from "../../constants/styleConstants";
import type { TemplaticalEditorConfig } from "../../index";
import type { ImageBlock, SyntaxPreset } from "@templatical/types";
import { containsMergeTag, SYNTAX_PRESETS } from "@templatical/types";
import { Image } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";

defineProps<{
  block: ImageBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ImageBlock>): void;
}>();

const { t } = useI18n();
const config = inject<TemplaticalEditorConfig>("config");
const mergeTagSyntax = inject<SyntaxPreset>(
  "mergeTagSyntax",
  SYNTAX_PRESETS.liquid,
);

const canBrowseMedia = computed(() => !!config?.onRequestMedia);

const pulseSrc = ref(false);
const pulseAlt = ref(false);

const { start: startPulseSrc } = useTimeoutFn(
  () => {
    pulseSrc.value = false;
  },
  1000,
  { immediate: false },
);

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<ImageBlock>);
}

async function openMediaBrowser(): Promise<void> {
  const result = await config?.onRequestMedia?.();
  if (result) {
    updateField("src", result.url);
    if (result.alt) {
      updateField("alt", result.alt);
      pulseAlt.value = true;
    }
    pulseSrc.value = true;
    startPulseSrc();
  }
}
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.imageUrl }}</label>
    <MergeTagInput
      :model-value="block.src"
      type="url"
      :placeholder="t.image.imageUrlPlaceholder"
      :pulse="pulseSrc"
      @update:model-value="updateField('src', $event)"
    />
    <button
      v-if="canBrowseMedia"
      class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
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
  <div v-if="containsMergeTag(block.src, mergeTagSyntax)" class="tpl:mb-3.5">
    <label :class="labelClass"
      >{{ t.image.placeholderUrl }}
      <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">{{
        "(optional)"
      }}</span>
    </label>
    <input
      type="url"
      :class="inputClass"
      :value="block.placeholderUrl || ''"
      :placeholder="t.image.placeholderUrlPlaceholder"
      @input="
        updateField('placeholderUrl', ($event.target as HTMLInputElement).value)
      "
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.altText }}</label>
    <MergeTagInput
      :model-value="block.alt"
      type="text"
      :placeholder="t.image.altTextPlaceholder"
      :pulse="pulseAlt"
      @update:model-value="updateField('alt', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.width }}</label>
    <select
      :class="inputClass"
      :value="block.width"
      @change="
        updateField(
          'width',
          ($event.target as HTMLSelectElement).value === 'full'
            ? 'full'
            : Number(($event.target as HTMLSelectElement).value),
        )
      "
    >
      <option value="full">{{ t.image.fullWidth }}</option>
      <option value="300">300px</option>
      <option value="400">400px</option>
      <option value="500">500px</option>
    </select>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.title.align }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft },
        { value: 'center', label: t.title.alignCenter },
        { value: 'right', label: t.title.alignRight },
      ]"
      :model-value="block.align"
      @update:model-value="updateField('align', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.linkUrl }}</label>
    <MergeTagInput
      :model-value="block.linkUrl || ''"
      type="url"
      :placeholder="t.image.imageUrlPlaceholder"
      @update:model-value="updateField('linkUrl', $event)"
    />
    <label
      v-if="block.linkUrl"
      class="tpl:mt-2 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
    >
      <input
        type="checkbox"
        class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
        :checked="block.linkOpenInNewTab ?? false"
        @change="
          updateField(
            'linkOpenInNewTab',
            ($event.target as HTMLInputElement).checked,
          )
        "
      />
      {{ t.image.openInNewTab }}
    </label>
  </div>
</template>
