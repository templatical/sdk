<script setup lang="ts">
import { computed, nextTick, ref, type Component } from "vue";
import { ArrowRight, ChevronRight } from "@lucide/vue";
import LogoIcon from "@/LogoIcon.vue";
import CatalogSketch from "@/host/CatalogSketch.vue";
import { SCENE_ICONS } from "@/host/catalogIcons";
import HostKnobs from "@/host/HostKnobs.vue";
import { CATALOG_NAV_GROUPS } from "@/host/catalogNav";
import { navigatePlayground, sceneHref } from "@/host/sceneHref";
import { resolveInitialShadowMode } from "@/host/shadowMode";
import { catalogInitKey } from "@/host/snippet-keys";
import { format, usePlaygroundI18n } from "@/i18n";
import { getScene, scenesByGroup, type Scene, type SceneGroup } from "@/scenes";

const { t } = usePlaygroundI18n();
const shadowMode = ref<"shadow" | "light">(resolveInitialShadowMode());

const minimum = getScene("minimum");
const grouped = scenesByGroup();

const NAV_GROUPS = CATALOG_NAV_GROUPS;
const activeGroup = ref<SceneGroup>("configure");

const setupTabs = computed(() =>
  NAV_GROUPS.flatMap((group) => {
    const scenes = grouped.get(group);
    if (!scenes?.length) return [];
    return [{ group, scenes }];
  }),
);

const activeScenes = computed(
  () =>
    setupTabs.value.find((tab) => tab.group === activeGroup.value)?.scenes ??
    [],
);

function hrefFor(scene: Scene): string {
  return sceneHref(scene.id, window.location.search);
}

function onSceneClick(event: MouseEvent, scene: Scene): void {
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
  navigatePlayground(hrefFor(scene));
}

function groupLabel(group: SceneGroup): string {
  return t.value.host.groups[group];
}

function groupJob(group: SceneGroup): string {
  if (group === "minimum") return "";
  return t.value.host.groupJobs[group];
}

function iconFor(scene: Scene): Component | undefined {
  return SCENE_ICONS[scene.id];
}

function initKeyFor(scene: Scene): string | null {
  return catalogInitKey(scene.title, scene.snippet);
}

function onNavKeydown(event: KeyboardEvent): void {
  const groups = setupTabs.value.map((tab) => tab.group);
  const index = groups.indexOf(activeGroup.value);
  if (index < 0) return;
  let next = index;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    next = Math.min(groups.length - 1, index + 1);
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    next = Math.max(0, index - 1);
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = groups.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  const group = groups[next];
  if (!group) return;
  activeGroup.value = group;
  void nextTick(() => {
    document.getElementById(`catalog-tab-${group}`)?.focus();
  });
}
</script>

<template>
  <main
    data-testid="catalog-screen"
    class="relative box-border flex flex-col min-h-screen font-sans bg-white text-gray-900 selection:bg-primary/20 dark:bg-gray-900 dark:text-gray-100"
  >
    <div class="absolute top-4 right-4 z-10">
      <HostKnobs v-model:shadow-mode="shadowMode" />
    </div>

    <div
      class="flex flex-col items-stretch max-w-[1080px] w-full mx-auto px-6 pt-12 pb-20"
    >
      <LogoIcon class="mb-5" />
      <h1
        class="m-0 mb-2 text-[22px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100"
      >
        {{ t.host.catalogTitle }}
      </h1>
      <p class="m-0 mb-8 text-[15px] text-gray-600 dark:text-gray-300">
        {{ t.host.catalogSubtitle }}
      </p>

      <a
        v-if="minimum"
        :href="hrefFor(minimum)"
        data-testid="scene-link-minimum"
        data-catalog-hero
        :aria-label="format(t.a11y.openScene, { name: minimum.title })"
        class="group flex items-center justify-between gap-6 mb-12 p-5 rounded-xl border border-gray-200 bg-white no-underline text-inherit transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
        @click="onSceneClick($event, minimum)"
      >
        <span class="min-w-0">
          <h2
            class="m-0 text-lg font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100"
          >
            {{ minimum.title }}
          </h2>
          <pre
            class="m-0 mt-2 text-[13px] font-mono text-gray-600 dark:text-gray-300"
            >{{ t.host.minimumPaste }}</pre>
        </span>
        <span
          class="inline-flex items-center gap-1.5 shrink-0 text-sm font-medium text-primary dark:text-primary-dark"
        >
          {{ t.host.openScene }}
          <ArrowRight
            :size="14"
            :stroke-width="1.75"
            aria-hidden="true"
            class="transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </span>
      </a>

      <section class="mb-12 flex gap-8 items-start" :aria-label="t.host.setups">
        <div
          role="tablist"
          aria-orientation="vertical"
          :aria-label="t.host.setups"
          class="pg-catalog-nav w-52 shrink-0 flex flex-col gap-1.5"
          @keydown="onNavKeydown"
        >
          <button
            v-for="tab in setupTabs"
            :key="tab.group"
            type="button"
            role="tab"
            :id="`catalog-tab-${tab.group}`"
            :data-testid="`catalog-tab-${tab.group}`"
            :aria-selected="activeGroup === tab.group"
            :aria-controls="`catalog-tabpanel-${tab.group}`"
            :tabindex="activeGroup === tab.group ? 0 : -1"
            class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left cursor-pointer font-sans transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            :class="
              activeGroup === tab.group
                ? 'catalog-tab-active border border-primary/30 bg-primary/10 text-gray-900 dark:border-primary/40 dark:bg-primary/15 dark:text-gray-100'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800'
            "
            @click="activeGroup = tab.group"
          >
            <span class="min-w-0 flex-1">
              <span
                class="block text-sm"
                :class="
                  activeGroup === tab.group
                    ? 'font-semibold text-gray-900 dark:text-gray-100'
                    : 'font-medium'
                "
                >{{ groupLabel(tab.group) }}</span
              >
              <span
                class="block mt-0.5 text-xs leading-snug"
                :class="
                  activeGroup === tab.group
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-600 dark:text-gray-400'
                "
                >{{ groupJob(tab.group) }}</span
              >
            </span>
            <ChevronRight
              :size="14"
              :stroke-width="1.75"
              aria-hidden="true"
              class="shrink-0"
              :class="
                activeGroup === tab.group
                  ? 'text-primary'
                  : 'text-gray-400 dark:text-gray-500'
              "
            />
          </button>
        </div>
        <div
          role="tabpanel"
          class="min-w-0 flex-1"
          :id="`catalog-tabpanel-${activeGroup}`"
          :aria-labelledby="`catalog-tab-${activeGroup}`"
        >
          <ul
            v-if="activeGroup === 'examples'"
            class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <li v-for="scene in activeScenes" :key="scene.id">
              <a
                :href="hrefFor(scene)"
                :data-testid="`scene-link-${scene.id}`"
                :aria-label="format(t.a11y.openScene, { name: scene.title })"
                class="group flex flex-col h-full overflow-hidden rounded-xl border border-gray-200 bg-white no-underline text-inherit transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
                @click="onSceneClick($event, scene)"
              >
                <CatalogSketch v-if="scene.preview" :kind="scene.preview" />
                <span class="flex flex-col gap-1 p-3">
                  <span
                    class="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >{{ scene.title }}</span
                  >
                  <span
                    class="text-xs leading-snug text-gray-600 dark:text-gray-300"
                    >{{ scene.job }}</span
                  >
                </span>
              </a>
            </li>
          </ul>
          <ul
            v-else
            class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <li v-for="scene in activeScenes" :key="scene.id">
              <a
                :href="hrefFor(scene)"
                :data-testid="`scene-link-${scene.id}`"
                :aria-label="format(t.a11y.openScene, { name: scene.title })"
                class="group flex gap-3 h-full p-4 rounded-xl border border-gray-200 bg-white no-underline text-inherit transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
                @click="onSceneClick($event, scene)"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-dark"
                >
                  <component
                    :is="iconFor(scene)"
                    v-if="iconFor(scene)"
                    :size="18"
                    :stroke-width="1.75"
                    aria-hidden="true"
                  />
                </span>
                <span class="min-w-0 flex flex-col gap-1">
                  <span
                    class="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >{{ scene.title }}</span
                  >
                  <span
                    class="text-xs leading-snug text-gray-600 dark:text-gray-300"
                    >{{ scene.job }}</span
                  >
                  <span
                    v-if="initKeyFor(scene)"
                    class="font-mono text-[11px] text-gray-500 dark:text-gray-400"
                    >{{ initKeyFor(scene) }}</span
                  >
                </span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      <nav
        class="mt-12 flex flex-wrap items-center gap-2 text-sm [&_a]:text-gray-600 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-gray-900 [&_a]:dark:text-gray-300 [&_a:hover]:dark:text-gray-100"
        :aria-label="t.host.catalogFooter"
      >
        <a
          href="https://docs.templatical.com"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t.toolbar.docs }}</a
        >
        <span class="text-gray-300 dark:text-gray-600" aria-hidden="true"
          >&middot;</span
        >
        <a
          href="https://github.com/templatical/sdk"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t.a11y.githubRepo"
          >GitHub</a
        >
        <span class="text-gray-300 dark:text-gray-600" aria-hidden="true"
          >&middot;</span
        >
        <a href="#cloud">{{ t.toolbar.tryCloud }}</a>
      </nav>
    </div>
  </main>
</template>
