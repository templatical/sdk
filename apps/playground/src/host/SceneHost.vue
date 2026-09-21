<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ChevronLeft } from "@lucide/vue";
import { getScene } from "@/scenes";
import { format, usePlaygroundI18n } from "@/i18n";
import { resolveInitialShadowMode } from "@/host/shadowMode";
import { unmountEditor, useSceneInit } from "@/host/useSceneInit";

const props = defineProps<{
  sceneId: string;
  search: URLSearchParams;
}>();

const { t } = usePlaygroundI18n();
const scene = computed(() => getScene(props.sceneId));
const editorContainer = ref<HTMLElement | null>(null);
const initError = ref("");
const codeOpen = ref(scene.value ? scene.value.group !== "examples" : false);

onMounted(async () => {
  const current = scene.value;
  const container = editorContainer.value;
  if (!current || !container) return;
  const shadowDom = resolveInitialShadowMode() === "shadow";
  const result = await useSceneInit(
    current,
    container,
    { search: props.search },
    shadowDom,
  );
  if (result.initError) {
    initError.value = format(t.value.error.initFailed, {
      message: result.initError,
    });
  }
});

onUnmounted(() => {
  unmountEditor();
});
</script>

<template>
  <main
    v-if="!scene"
    data-testid="scene-not-found"
    class="flex flex-col items-center justify-center min-h-screen gap-3 font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <p class="m-0 text-xs">{{ t.host.notFound }}</p>
    <a href="/" class="pg-toolbar-btn no-underline">{{ t.host.back }}</a>
  </main>
  <div
    v-else
    data-testid="scene-host"
    class="flex flex-col h-screen font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <header
      class="flex items-center justify-between h-12 px-4 bg-gray-100 shrink-0 z-[100] dark:bg-gray-800 gap-2 overflow-x-auto"
    >
      <div class="flex items-center gap-2 min-w-0">
        <a href="/" class="pg-toolbar-btn no-underline">
          <ChevronLeft :size="16" :stroke-width="1.5" aria-hidden="true" />
          <span class="pg-toolbar-label">{{ t.host.back }}</span>
        </a>
        <h1 class="m-0 text-xs font-medium truncate">{{ scene.title }}</h1>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <a
          :href="'https://docs.templatical.com' + scene.docs"
          target="_blank"
          rel="noopener noreferrer"
          class="pg-toolbar-btn no-underline"
          >{{ t.host.docs }}</a
        >
        <button
          type="button"
          class="pg-toolbar-btn"
          :aria-pressed="codeOpen"
          @click="codeOpen = !codeOpen"
        >
          {{ t.host.code }}
        </button>
      </div>
    </header>
    <div data-testid="editor-screen" class="flex flex-1 min-h-0">
      <div
        v-if="initError"
        class="flex-1 flex items-center justify-center p-8 text-xs text-red-500"
      >
        {{ initError }}
      </div>
      <div
        v-else
        ref="editorContainer"
        data-testid="editor-container"
        class="flex-1 min-w-0 min-h-0 overflow-hidden bg-white dark:bg-gray-800"
      />
      <aside
        v-show="codeOpen"
        data-testid="code-drawer"
        class="w-[min(28rem,40vw)] shrink-0 overflow-auto border-l border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <pre class="m-0 text-xs font-mono whitespace-pre-wrap">{{
          scene.snippet
        }}</pre>
      </aside>
    </div>
  </div>
</template>
