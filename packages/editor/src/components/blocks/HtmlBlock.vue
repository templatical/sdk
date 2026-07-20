<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type {
  HtmlBlock as HtmlBlockType,
  ViewportSize,
} from "@templatical/types";
import { HTML_BLOCK_PREVIEW_KEY } from "../../keys";
import { Code } from "@lucide/vue";
import { computed, inject, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  block: HtmlBlockType;
  viewport: ViewportSize;
}>();

const { t } = useI18n();

// Opt-in via `config.htmlBlockPreview` (default off → static placeholder).
const previewEnabled = inject(HTML_BLOCK_PREVIEW_KEY, false);

const hasContent = computed(() => props.block.content.trim().length > 0);
const showPreview = computed(() => previewEnabled && hasContent.value);

// --- Sandboxed-iframe live preview ----------------------------------------
// The fragment renders verbatim with scripting disabled
// (`sandbox="allow-same-origin"`, no `allow-scripts`), so nothing in it can
// execute and its styles can't escape the frame. `allow-same-origin` — without
// `allow-scripts` — is what lets the parent read `contentDocument` to size the
// frame to its content; there's no script inside to abuse the same origin.
const iframeRef = ref<HTMLIFrameElement | null>(null);
const height = ref(60);
let resizeObserver: ResizeObserver | null = null;

function measure(): void {
  const doc = iframeRef.value?.contentDocument;
  if (!doc) return;
  height.value = Math.max(
    doc.body?.scrollHeight ?? 0,
    doc.documentElement?.scrollHeight ?? 0,
  );
}

function onIframeLoad(): void {
  // Each `srcdoc` change loads a fresh document, so re-attach the observer to
  // the new document's root to catch late reflow (e.g. images loading in).
  resizeObserver?.disconnect();
  resizeObserver = null;
  measure();
  const root = iframeRef.value?.contentDocument?.documentElement;
  if (root && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(root);
  }
}

// Tear the observer down when the preview goes away so a later re-enable
// doesn't keep measuring a detached document.
watch(showPreview, (on) => {
  if (!on) {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div class="tpl:w-full">
    <iframe
      v-if="showPreview"
      ref="iframeRef"
      :srcdoc="block.content"
      sandbox="allow-same-origin"
      :title="t.html.preview"
      class="tpl:block tpl:w-full tpl:border-0"
      :style="{ height: `${height}px` }"
      @load="onIframeLoad"
    />
    <div
      v-else
      class="tpl:flex tpl:min-h-[80px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border tpl:border-dashed tpl:py-4 tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)]"
    >
      <Code :size="24" class="tpl:text-[var(--tpl-text-dim)]" />
      <span
        v-if="hasContent"
        class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
      >
        {{ t.html.preview }}
      </span>
      <span v-else class="tpl:text-sm tpl:text-[var(--tpl-text-dim)]">
        {{ t.html.empty }}
      </span>
    </div>
  </div>
</template>
