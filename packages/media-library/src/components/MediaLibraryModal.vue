<script setup lang="ts">
import MediaLibraryChrome from "./MediaLibraryChrome.vue";
import type {
  MediaAsset,
  MediaCategory,
  MediaProvider,
} from "@templatical/types";
import { useEventListener } from "@vueuse/core";
import { useFocusTrap } from "../composables/useFocusTrap";
import { computed, provide, ref, toRef, watch } from "vue";
import {
  POPOVER_TARGET_KEY,
  TRANSLATIONS_KEY,
  UI_LOCALE_KEY,
  UI_THEME_KEY,
} from "../keys";
import { loadMediaTranslations, type MediaTranslations } from "../i18n";

const props = defineProps<{
  visible: boolean;
  /**
   * Storage backend. **A prop, not an injection.** An injection would have
   * to agree with the host on key identity: a bare string never resolves
   * the `Symbol` a host provides, and the miss is silent. A prop is checked
   * at compile time.
   */
  provider: MediaProvider;
  accept?: MediaCategory[];
  popoverTarget?: HTMLElement | null;
  /**
   * BCP-47 locale for this package's own strings, defaulting to English.
   *
   * A locale rather than the strings themselves: media-library owns its
   * translations and loads them here, so a host passes a value it already has
   * and never handles media copy. That also keeps the load lazy — the host
   * imports nothing from this package's i18n, so nothing is fetched until this
   * modal mounts.
   */
  locale?: string;
  /**
   * Resolved UI theme (`"light"` / `"dark"`) for the overlay chrome.
   *
   * A plain string rather than the host's ref: props are reactive, so the
   * computed below tracks a host theme toggle without this package depending on
   * how the host stores it.
   */
  uiTheme?: string;
  /** Forwarded on list / create / importFromUrl when a template is loaded. */
  templateId?: string;
  /**
   * Failures from the storage provider. The composable already reports
   * them here; a host that wants them on its own `onError` passes that
   * function through. Standalone `init()` has no such config, so this
   * stays optional.
   */
  onError?: (error: Error) => void;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select", item: MediaAsset): void;
}>();

const translations = ref<MediaTranslations | null>(null);
watch(
  () => props.locale,
  async (locale) => {
    translations.value = await loadMediaTranslations(locale ?? "en");
  },
  { immediate: true },
);

provide(TRANSLATIONS_KEY, translations);

const tplUiTheme = computed(() => props.uiTheme);
provide(UI_THEME_KEY, tplUiTheme);

const popoverTargetRef = toRef(() => props.popoverTarget ?? null);
provide(POPOVER_TARGET_KEY, popoverTargetRef);

provide(
  UI_LOCALE_KEY,
  toRef(() => props.locale),
);

const dialogRef = ref<HTMLElement | null>(null);
const chromeRef = ref<{
  nestedDialogOpen: boolean;
  handleEscape: () => boolean;
} | null>(null);

const trapActive = computed(
  () =>
    props.visible &&
    translations.value !== null &&
    !chromeRef.value?.nestedDialogOpen,
);

useFocusTrap(dialogRef, trapActive);

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }
  if (chromeRef.value?.handleEscape()) {
    event.preventDefault();
    return;
  }
  emit("close");
}
useEventListener(document, "keydown", handleKeydown);

function handleConfirm(item: MediaAsset): void {
  emit("select", item);
  emit("close");
}
</script>

<template>
  <Teleport :to="popoverTarget || 'body'">
    <Transition
      enter-active-class="tpl:transition tpl:duration-200"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition tpl:duration-150"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <!-- `translations` gates the subtree, not just this element's own labels:
           every descendant unwraps `TRANSLATIONS_KEY` at its own setup, so none
           may mount before the locale's strings have landed. -->
      <div
        v-if="visible && translations"
        data-testid="media-library-modal"
        :data-tpl-theme="tplUiTheme"
        :class="[
          popoverTarget ? undefined : 'tpl',
          'tpl-media-overlay tpl:fixed tpl:inset-0 tpl:z-10 tpl:flex tpl:items-center tpl:justify-center tpl:p-4',
        ]"
        style="
          background-color: var(--tpl-overlay);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        "
        @click.self="emit('close')"
      >
        <!-- Caps are percentages of the overlay, never viewport units. This
             overlay is `fixed; inset: 0`, which covers the viewport only while
             nothing traps it — an ancestor with `transform`, `filter`,
             `backdrop-filter`, `will-change: transform`, `contain: paint` or
             `container-type` becomes the containing block for fixed
             descendants, and this modal teleports into the editor's popover
             root, i.e. inside a consumer's markup. `inset: 0` then resolves to
             that ancestor's box while a viewport cap does not, and the panel
             overflows a container that usually also has `overflow: hidden`.
             Percentages resolve against whatever the overlay turned out to be.
             Locked by `tests/overlay-height-scope-audit.test.ts`.

             `width` / `height` are the untrapped size (900×650). They are not
             a fixed preference — `max-height` is what reins it in. -->
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-media-library-title"
          data-testid="media-library-dialog"
          class="tpl-media-modal tpl-scale-in tpl:flex tpl:flex-col tpl:overflow-hidden tpl:rounded-[var(--tpl-radius-lg)]"
          style="
            width: 900px;
            height: 650px;
            max-width: 100%;
            max-height: 90%;
            background-color: var(--tpl-bg-elevated);
            border: 1px solid var(--tpl-border);
            box-shadow: var(--tpl-shadow-xl);
          "
        >
          <MediaLibraryChrome
            ref="chromeRef"
            :provider="provider"
            :accept="accept"
            :template-id="templateId"
            :on-error="onError"
            :translations="translations"
            show-close
            show-confirm
            confirm-test-id="media-confirm"
            @close="emit('close')"
            @confirm="handleConfirm"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
