<script setup lang="ts">
import type {
  CountdownBlock as CountdownBlockType,
  CountdownProvider,
  ViewportSize,
} from "@templatical/types";
import { countdownAltText } from "@templatical/types";
import { refDebounced } from "@vueuse/core";
import { computed, inject, watch } from "vue";
import {
  COUNTDOWN_IMAGE_DEBOUNCE_MS,
  useCountdownImage,
} from "../../composables/useCountdownImage";
import { useI18n } from "../../composables/useI18n";
import { useResolvedImageSrc } from "../../composables/useImageUrlResolver";
import { COUNTDOWN_PROVIDER_KEY, EDITOR_KEY } from "../../keys";

const props = defineProps<{
  block: CountdownBlockType;
  viewport: ViewportSize;
}>();

const { t } = useI18n();
const provider = inject<CountdownProvider | null>(COUNTDOWN_PROVIDER_KEY, null);
const editor = inject(EDITOR_KEY, null);
const rawImageUrl = computed(() => provider?.imageUrl(props.block) ?? "");
const resolvedImageUrl = useResolvedImageSrc(() => rawImageUrl.value);
const targetUrl = refDebounced(resolvedImageUrl, COUNTDOWN_IMAGE_DEBOUNCE_MS);
const { shownUrl, isUpdating, failedUrl } = useCountdownImage(
  () => targetUrl.value ?? "",
);
const alt = computed(() =>
  countdownAltText(props.block, editor?.content.value.settings.locale),
);

watch(
  () => props.block,
  () => {
    failedUrl.value = "";
  },
);
</script>

<template>
  <!-- BlockWrapper applies styles.padding around this image, as for ImageBlock. -->
  <div
    v-if="failedUrl"
    data-testid="countdown-placeholder"
    data-state="failed"
    class="tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:py-8 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
  >
    <span>{{ t.countdown.imageFailed }}</span>
    <span class="tpl:break-all">{{ failedUrl }}</span>
  </div>

  <div v-else-if="shownUrl" class="tpl:relative tpl:text-center">
    <img
      data-testid="countdown-image"
      :src="shownUrl"
      :alt="alt"
      class="tpl:mx-auto tpl:block tpl:max-w-full tpl:h-auto"
      :class="{ 'tpl:opacity-50': isUpdating }"
    />
    <span
      v-if="isUpdating"
      data-testid="countdown-updating"
      role="status"
      aria-live="polite"
      class="tpl:absolute tpl:top-2 tpl:start-2 tpl:rounded-full tpl:border tpl:border-[var(--tpl-chrome-border-light)] tpl:bg-[var(--tpl-chrome-bg-elevated)] tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-chrome-text-muted)] tpl:shadow-[var(--tpl-shadow-sm)]"
    >
      {{ t.countdown.updating }}
    </span>
  </div>

  <div
    v-else-if="!block.targetDate"
    data-testid="countdown-placeholder"
    data-state="no-date"
    class="tpl:flex tpl:items-center tpl:justify-center tpl:py-8 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
  >
    {{ t.countdown.setDate }}
  </div>

  <div
    v-else-if="isUpdating"
    data-testid="countdown-placeholder"
    data-state="loading"
    class="tpl:flex tpl:items-center tpl:justify-center tpl:py-8 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
  >
    {{ t.countdown.updating }}
  </div>

  <div
    v-else
    data-testid="countdown-placeholder"
    data-state="no-image"
    class="tpl:flex tpl:items-center tpl:justify-center tpl:py-8 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
  >
    {{ t.countdown.noImage }}
  </div>
</template>
