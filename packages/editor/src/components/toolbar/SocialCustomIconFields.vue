<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import MediaDropOverlay from "../MediaDropOverlay.vue";
import MergeTagInput from "../MergeTagInput.vue";
import { useI18n } from "../../composables/useI18n";
import { useMediaDropField } from "../../composables/useMediaDropField";
import type { CustomSocialIcon, MediaResult } from "@templatical/types";
import { containsMergeTag, SYNTAX_PRESETS } from "@templatical/types";
import { Image } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { MERGE_TAG_SYNTAX_KEY } from "../../keys";

const props = defineProps<{
  icon: CustomSocialIcon;
}>();

const emit = defineEmits<{
  (e: "update", icon: CustomSocialIcon): void;
}>();

const { t } = useI18n();
const mergeTagSyntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);

const dropZoneRef = ref<HTMLElement>();
// Stored content can omit imageUrl or hold a non-string. Both are empty.
const imageUrl = computed(() =>
  typeof props.icon.imageUrl === "string" ? props.icon.imageUrl : "",
);
// A merge-tag image URL is a deliberate dynamic value — a drop must not
// replace it. Browse still opens.
const hasMergeTagSrc = computed(() =>
  containsMergeTag(imageUrl.value, mergeTagSyntax),
);

function fieldPath(field: "imageUrl" | "alt"): string | undefined {
  return props.icon.id.includes(".")
    ? undefined
    : `icons.${props.icon.id}.${field}`;
}

function updateImageUrl(value: string): void {
  if (value === imageUrl.value) return;
  emit("update", { ...props.icon, imageUrl: value });
}

function updateAlt(value: string): void {
  emit("update", { ...props.icon, alt: value });
}

function applyMedia(result: MediaResult): void {
  const next: CustomSocialIcon = { ...props.icon, imageUrl: result.url };
  if (result.alt) next.alt = result.alt;
  emit("update", next);
}

const { canBrowse, isUploading, showOverlay, openMediaBrowser } =
  useMediaDropField({
    target: dropZoneRef,
    blocked: hasMergeTagSrc,
    apply: applyMedia,
  });
</script>

<template>
  <FieldRow :path="fieldPath('imageUrl')" :label="t.image.imageUrl">
    <div ref="dropZoneRef" class="tpl:relative">
      <MediaDropOverlay v-if="showOverlay" :uploading="isUploading" />
      <MergeTagInput
        :model-value="imageUrl"
        type="url"
        :placeholder="t.image.imageUrlPlaceholder"
        @update:model-value="updateImageUrl"
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
  <FieldRow :path="fieldPath('alt')" :label="t.image.altText">
    <MergeTagInput
      :model-value="icon.alt ?? ''"
      type="text"
      :placeholder="t.image.altTextPlaceholder"
      @update:model-value="updateAlt"
    />
  </FieldRow>
</template>
