<script setup lang="ts">
import MediaLibraryChrome from "../components/MediaLibraryChrome.vue";
import type {
  MediaAsset,
  MediaCategory,
  MediaProvider,
} from "@templatical/types";
import type { MediaTranslations } from "../i18n";
import { computed, provide, ref, toRef } from "vue";
import { TRANSLATIONS_KEY, UI_LOCALE_KEY } from "../keys";

const props = defineProps<{
  /**
   * Storage backend. **A prop, not an injection.** A bare string never
   * resolves the `Symbol` a host provides, and the miss is silent. A prop
   * is checked at compile time.
   */
  provider: MediaProvider;
  translations: MediaTranslations;
  onSelect?: (asset: MediaAsset) => void;
  accept?: MediaCategory[];
  locale?: string;
}>();

const emit = defineEmits<{
  (e: "ready"): void;
}>();

const t = computed(() => props.translations);

// `TRANSLATIONS_KEY`, not the bare string: a string never resolves the
// `Symbol` a host provides under the same name. Wrapped in a ref because
// the key carries one — this shell always has its strings up front.
provide(TRANSLATIONS_KEY, ref(props.translations));

provide(
  UI_LOCALE_KEY,
  toRef(() => props.locale),
);

function handleConfirm(item: MediaAsset): void {
  props.onSelect?.(item);
}
</script>

<template>
  <div
    class="tpl tpl:flex tpl:flex-col tpl:overflow-hidden tpl:rounded-[var(--tpl-radius-lg)]"
    style="
      width: 100%;
      height: 100%;
      background-color: var(--tpl-bg-elevated);
      border: 1px solid var(--tpl-border);
    "
  >
    <MediaLibraryChrome
      :provider="provider"
      :accept="accept"
      :translations="t"
      :show-confirm="!!onSelect"
      confirm-test-id="media-select"
      @confirm="handleConfirm"
      @ready="emit('ready')"
    />
  </div>
</template>
