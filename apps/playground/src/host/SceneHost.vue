<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from "vue";
import {
  ArrowUpRight,
  ChevronLeft,
  CodeXml,
  Download,
  Share2,
} from "@lucide/vue";
import type { TemplaticalEditor } from "@templatical/editor";
import CatalogRail from "@/host/CatalogRail.vue";
import CodeDialog from "@/host/CodeDialog.vue";
import ExportModal from "@/host/ExportModal.vue";
import HostKnobs from "@/host/HostKnobs.vue";
import HostTour from "@/host/HostTour.vue";
import ImportPastePanel from "@/host/ImportPastePanel.vue";
import ShareModal from "@/host/ShareModal.vue";
import { navigatePlayground } from "@/host/sceneHref";
import { createSerializedBoot } from "@/host/bootQueue";
import { SHARE_LOAD_FAILED, SHARE_NOT_FOUND } from "@/host/share";
import { resolveShadowDom } from "@/host/shadowMode";
import { useSceneInit } from "@/host/useSceneInit";
import { format, usePlaygroundI18n, usePlaygroundTheme } from "@/i18n";
import { getScene } from "@/scenes";

const props = defineProps<{
  sceneId: string;
  search: URLSearchParams;
}>();

const { t } = usePlaygroundI18n();
const { theme: uiTheme } = usePlaygroundTheme();
const scene = computed(() => getScene(props.sceneId));
const editorContainer = ref<HTMLElement | null>(null);
const initError = ref("");
const sceneReady = ref(false);
const codeOpen = ref(false);
const shadowDom = resolveShadowDom();
const editor = shallowRef<TemplaticalEditor | null>(null);
const exportOpen = ref(false);
const shareOpen = ref(false);
const retryTick = ref(0);

const isShareError = computed(
  () =>
    initError.value === SHARE_NOT_FOUND ||
    initError.value === SHARE_LOAD_FAILED,
);

const initErrorCopy = computed(() => {
  if (initError.value === SHARE_NOT_FOUND)
    return t.value.sharedTemplate.notFound;
  if (initError.value === SHARE_LOAD_FAILED) {
    return t.value.sharedTemplate.error;
  }
  return initError.value;
});

function retryInit(): void {
  retryTick.value += 1;
}

/** Back lands on the scene's own section of the catalog, not its top. */
function catalogHref(): string {
  const shadow = props.search.get("shadowDom");
  const base = shadow !== null ? `/?shadowDom=${shadow}` : "/";
  const group = scene.value?.group;
  return group && group !== "minimum" ? `${base}#group-${group}` : base;
}

function onBack(event: MouseEvent): void {
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }
  event.preventDefault();
  navigatePlayground(catalogHref());
}

watch(uiTheme, (theme) => {
  editor.value?.setTheme(theme);
});

const boot = createSerializedBoot();

watch(
  () => [props.sceneId, props.search.toString(), retryTick.value] as const,
  () => {
    void boot.enqueue(async (isCurrent) => {
      const current = scene.value;
      sceneReady.value = false;
      initError.value = "";
      editor.value?.unmount();
      editor.value = null;
      if (!current || !isCurrent()) return;
      await nextTick();
      if (!isCurrent()) return;
      const container = editorContainer.value;
      if (!container) return;
      const result = await useSceneInit(
        current,
        container,
        { search: props.search },
        shadowDom,
      );
      if (!isCurrent()) {
        result.editor?.unmount();
        return;
      }
      if (result.initError) {
        initError.value =
          result.initError === SHARE_NOT_FOUND ||
          result.initError === SHARE_LOAD_FAILED
            ? result.initError
            : format(t.value.error.initFailed, {
                message: result.initError,
              });
      } else {
        editor.value = result.editor;
        if (result.editor) {
          result.editor.setTheme(uiTheme.value);
        }
      }
      sceneReady.value = true;
    });
  },
  { immediate: true, flush: "post" },
);

onUnmounted(() => {
  boot.invalidate();
  editor.value?.unmount();
  editor.value = null;
});
</script>

<template>
  <main
    v-if="!scene"
    data-testid="scene-not-found"
    class="flex flex-col items-center justify-center min-h-screen gap-3 px-6 font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <h1 class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
      {{ format(t.host.notFoundNamed, { id: sceneId }) }}
    </h1>
    <p class="m-0 text-sm text-gray-600 dark:text-gray-300">
      {{ t.host.notFoundHint }}
    </p>
    <a href="/" class="pg-toolbar-btn no-underline">{{ t.host.back }}</a>
  </main>
  <div
    v-else
    data-testid="scene-host"
    :data-scene-ready="sceneReady ? 'true' : undefined"
    class="flex h-screen font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <CatalogRail :current-id="scene.id" />
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        data-testid="scene-header"
        class="flex items-center justify-between h-14 px-4 bg-gray-100 shrink-0 z-[100] dark:bg-gray-800 gap-3"
      >
        <div class="flex items-center gap-3 min-w-0">
          <a
            :href="catalogHref()"
            data-testid="toolbar-back"
            class="pg-toolbar-btn no-underline"
            :title="t.a11y.backToCatalog"
            :aria-label="t.a11y.backToCatalog"
            @click="onBack"
          >
            <ChevronLeft :size="16" :stroke-width="1.5" aria-hidden="true" />
            <span class="pg-toolbar-label">{{ t.host.back }}</span>
          </a>
          <div class="min-w-0">
            <h1
              class="m-0 truncate text-base font-semibold leading-tight text-gray-900 dark:text-gray-100"
            >
              {{ scene.title }}
            </h1>
            <p
              data-testid="scene-summary"
              class="m-0 mt-0.5 truncate text-xs text-gray-600 dark:text-gray-400"
              :title="scene.summary"
            >
              {{ scene.summary }}
            </p>
          </div>
        </div>
        <!-- No overflow clipping here: the settings popover hangs below. -->
        <div class="flex items-center gap-1 shrink-0">
          <a
            :href="'https://docs.templatical.com' + scene.docs"
            data-testid="toolbar-docs"
            target="_blank"
            rel="noopener noreferrer"
            class="pg-toolbar-link"
          >
            {{ t.host.docs }}
            <ArrowUpRight :size="14" :stroke-width="1.75" aria-hidden="true" />
          </a>
          <button
            type="button"
            data-testid="toolbar-share"
            class="pg-toolbar-icon-btn"
            :title="t.toolbar.share"
            :aria-label="t.toolbar.share"
            :disabled="!editor"
            @click="shareOpen = true"
          >
            <Share2 :size="16" :stroke-width="1.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="toolbar-export"
            class="pg-toolbar-icon-btn"
            :title="t.toolbar.export"
            :aria-label="t.toolbar.export"
            :disabled="!editor"
            @click="exportOpen = true"
          >
            <Download :size="16" :stroke-width="1.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="toolbar-code"
            class="pg-toolbar-primary ml-1"
            :aria-pressed="codeOpen"
            :aria-expanded="codeOpen"
            aria-controls="code-dialog"
            @click="codeOpen = true"
          >
            <CodeXml :size="16" :stroke-width="1.75" aria-hidden="true" />
            {{ t.host.code }}
          </button>
          <HostKnobs />
        </div>
      </header>
      <!--
      Gray well + rounded card. Do not add `isolate` — that traps the
      editor popover root (z 10000) so the playground header paints over
      dialogs.
    -->
      <div
        data-testid="editor-screen"
        class="flex flex-1 min-h-0 bg-gray-100 p-[15px] dark:bg-gray-800"
      >
        <div
          data-testid="editor-stage"
          class="pg-scene-stage relative flex-1 min-w-0 min-h-0 rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700"
        >
          <div
            v-if="initError"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-8 text-sm bg-white dark:bg-gray-900"
            role="alert"
          >
            <p class="m-0 text-red-700 dark:text-red-400">
              {{ initErrorCopy }}
            </p>
            <a
              v-if="isShareError"
              href="/"
              class="pg-toolbar-btn no-underline"
              >{{ t.sharedTemplate.goToPlayground }}</a
            >
            <button
              v-else
              type="button"
              data-testid="init-retry"
              class="pg-toolbar-btn"
              @click="retryInit"
            >
              {{ t.toolbar.retry }}
            </button>
          </div>
          <div
            ref="editorContainer"
            data-testid="editor-container"
            class="h-full min-w-0 min-h-0 overflow-hidden bg-white dark:bg-gray-800"
          />
          <ImportPastePanel
            v-if="scene.group === 'import'"
            :scene-id="scene.id"
            :editor="editor"
          />
        </div>
      </div>
      <CodeDialog
        v-model:open="codeOpen"
        :snippet="scene.snippet"
        :docs="scene.docs"
      />
      <ExportModal v-model:open="exportOpen" :editor="editor" />
      <ShareModal
        v-model:open="shareOpen"
        :editor="editor"
        :scene-id="scene.id"
      />
      <HostTour :ready="sceneReady" />
    </div>
  </div>
</template>
