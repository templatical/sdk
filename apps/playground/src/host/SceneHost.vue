<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from "vue";
import { ChevronDown, ChevronLeft } from "@lucide/vue";
import type { TemplaticalEditor } from "@templatical/editor";
import HostKnobs from "@/host/HostKnobs.vue";
import { navigatePlayground, sceneHref } from "@/host/sceneHref";
import { resolveInitialShadowMode } from "@/host/shadowMode";
import { unmountEditor, useSceneInit } from "@/host/useSceneInit";
import { format, usePlaygroundI18n, usePlaygroundTheme } from "@/i18n";
import {
  getScene,
  SCENE_GROUP_ORDER,
  scenesByGroup,
  type Scene,
  type SceneGroup,
} from "@/scenes";

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
const shadowMode = ref<"shadow" | "light">(resolveInitialShadowMode());
const editor = shallowRef<TemplaticalEditor | null>(null);
const titleOpen = ref(false);
const switcherList = ref<HTMLElement | null>(null);

const grouped = scenesByGroup();
const switcherSections = computed(() =>
  SCENE_GROUP_ORDER.flatMap((group) => {
    const scenes = grouped.get(group);
    if (!scenes?.length) return [];
    return [{ group, scenes }];
  }),
);

function groupLabel(group: SceneGroup): string {
  return t.value.host.groups[group];
}

function hrefFor(target: Scene): string {
  return sceneHref(target.id, props.search);
}

function onSwitcherClick(event: MouseEvent, target: Scene): void {
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
  switcherList.value?.hidePopover();
  titleOpen.value = false;
  if (target.id === props.sceneId) return;
  navigatePlayground(hrefFor(target));
}

function onSwitcherToggle(event: Event): void {
  titleOpen.value = (event as ToggleEvent).newState === "open";
}

watch(
  () => scene.value?.group,
  (group) => {
    codeOpen.value = group !== "examples";
  },
  { immediate: true },
);

watch(uiTheme, (theme) => {
  editor.value?.setTheme(theme);
});

let bootGen = 0;

watch(
  () => [props.sceneId, props.search.toString(), shadowMode.value] as const,
  async () => {
    const gen = ++bootGen;
    const current = scene.value;
    sceneReady.value = false;
    initError.value = "";
    editor.value = null;
    unmountEditor();
    if (!current) return;
    await nextTick();
    if (gen !== bootGen) return;
    const container = editorContainer.value;
    if (!container) return;
    const result = await useSceneInit(
      current,
      container,
      { search: props.search },
      shadowMode.value === "shadow",
    );
    if (gen !== bootGen) {
      unmountEditor();
      return;
    }
    if (result.initError) {
      initError.value = format(t.value.error.initFailed, {
        message: result.initError,
      });
    } else {
      editor.value = result.editor;
      if (result.editor) {
        result.editor.setTheme(uiTheme.value);
      }
    }
    sceneReady.value = true;
  },
  { immediate: true, flush: "post" },
);

onUnmounted(() => {
  bootGen += 1;
  unmountEditor();
});
</script>

<template>
  <main
    v-if="!scene"
    data-testid="scene-not-found"
    class="flex flex-col items-center justify-center min-h-screen gap-3 font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <p class="m-0 text-sm text-gray-600 dark:text-gray-300">
      {{ t.host.notFound }}
    </p>
    <a href="/" class="pg-toolbar-btn no-underline">{{ t.host.back }}</a>
  </main>
  <div
    v-else
    data-testid="scene-host"
    :data-scene-ready="sceneReady ? 'true' : undefined"
    class="flex flex-col h-screen font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <header
      class="flex items-center justify-between h-12 px-4 bg-gray-100 shrink-0 z-[100] dark:bg-gray-800 gap-2"
    >
      <div class="flex items-center gap-2 min-w-0">
        <a
          href="/"
          data-testid="toolbar-back"
          class="pg-toolbar-btn no-underline"
          :title="t.a11y.backToCatalog"
          :aria-label="t.a11y.backToCatalog"
        >
          <ChevronLeft :size="16" :stroke-width="1.5" aria-hidden="true" />
          <span class="pg-toolbar-label">{{ t.host.back }}</span>
        </a>
        <h1 class="m-0 min-w-0">
          <button
            type="button"
            data-testid="scene-switcher"
            class="scene-switcher-btn pg-toolbar-btn max-w-[min(20rem,40vw)]"
            popovertarget="scene-switcher-list"
            :aria-expanded="titleOpen"
            aria-haspopup="true"
            aria-controls="scene-switcher-list"
            :title="t.host.switchScene"
          >
            <span class="truncate">{{ scene.title }}</span>
            <ChevronDown
              :size="14"
              :stroke-width="1.5"
              aria-hidden="true"
              class="shrink-0"
            />
          </button>
        </h1>
        <div
          id="scene-switcher-list"
          ref="switcherList"
          popover
          data-testid="scene-switcher-list"
          role="navigation"
          :aria-label="t.host.sceneList"
          class="scene-switcher-list w-[min(22rem,calc(100vw-2rem))] max-h-[min(24rem,70vh)] overflow-auto rounded-lg border border-gray-200 bg-white p-2 shadow-float dark:border-gray-700 dark:bg-gray-800"
          @toggle="onSwitcherToggle"
        >
          <section
            v-for="section in switcherSections"
            :key="section.group"
            class="mb-2 last:mb-0"
          >
            <h2
              class="m-0 px-2 py-1 text-xs font-semibold uppercase tracking-[0.04em] text-gray-600 dark:text-gray-300"
            >
              {{ groupLabel(section.group) }}
            </h2>
            <ul class="m-0 p-0 list-none">
              <li v-for="item in section.scenes" :key="item.id">
                <a
                  :href="hrefFor(item)"
                  :aria-current="item.id === scene.id ? 'page' : undefined"
                  class="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-sm no-underline text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-100 dark:hover:bg-gray-700"
                  :class="
                    item.id === scene.id
                      ? 'bg-gray-100 font-medium dark:bg-gray-700'
                      : ''
                  "
                  @click="onSwitcherClick($event, item)"
                >
                  <span class="truncate">{{ item.title }}</span>
                  <span
                    class="shrink-0 font-mono text-xs text-gray-600 dark:text-gray-300"
                    >{{ item.id }}</span
                  >
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0 overflow-x-auto">
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
          :aria-expanded="codeOpen"
          aria-controls="code-drawer"
          @click="codeOpen = !codeOpen"
        >
          {{ t.host.code }}
        </button>
        <HostKnobs v-model:shadow-mode="shadowMode" />
      </div>
    </header>
    <div data-testid="editor-screen" class="flex flex-1 min-h-0">
      <div class="relative flex-1 min-w-0 min-h-0">
        <div
          v-if="initError"
          class="absolute inset-0 z-10 flex items-center justify-center p-8 text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-900"
        >
          {{ initError }}
        </div>
        <div
          ref="editorContainer"
          data-testid="editor-container"
          class="h-full min-w-0 min-h-0 overflow-hidden bg-white dark:bg-gray-800"
        />
      </div>
      <aside
        v-show="codeOpen"
        id="code-drawer"
        data-testid="code-drawer"
        :aria-label="t.host.snippet"
        class="w-[min(28rem,40vw)] shrink-0 overflow-auto border-l border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <pre class="m-0 text-xs font-mono whitespace-pre-wrap">{{
          scene.snippet
        }}</pre>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.scene-switcher-btn {
  anchor-name: --scene-switcher;
}
.scene-switcher-list {
  position-anchor: --scene-switcher;
  inset: unset;
  top: anchor(bottom);
  left: anchor(left);
  margin: 4px 0 0;
}
</style>
