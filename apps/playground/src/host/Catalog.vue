<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight } from "@lucide/vue";
import LogoIcon from "@/LogoIcon.vue";
import CatalogSketch from "@/host/CatalogSketch.vue";
import HostKnobs from "@/host/HostKnobs.vue";
import SetupSketch from "@/host/SetupSketch.vue";
import { sceneHref } from "@/host/sceneHref";
import { resolveInitialShadowMode } from "@/host/shadowMode";
import { format, usePlaygroundI18n } from "@/i18n";
import { getScene, scenesByGroup, type Scene, type SceneGroup } from "@/scenes";

const { t } = usePlaygroundI18n();
const shadowMode = ref<"shadow" | "light">(resolveInitialShadowMode());

const minimum = getScene("minimum");
const grouped = scenesByGroup();

const TAB_GROUPS: SceneGroup[] = ["storage", "author", "import"];
const activeGroup = ref<SceneGroup>("storage");

const setupTabs = computed(() =>
  TAB_GROUPS.flatMap((group) => {
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

const exampleScenes = computed(() => grouped.get("examples") ?? []);

function hrefFor(scene: Scene): string {
  return sceneHref(scene.id, window.location.search);
}

function groupLabel(group: SceneGroup): string {
  return t.value.host.groups[group];
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
      >
        <span class="min-w-0">
          <span
            class="block text-lg font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100"
            >{{ minimum.title }}</span
          >
          <pre
            class="m-0 mt-2 text-[13px] font-mono text-gray-600 dark:text-gray-300"
            >{{ t.host.minimumPaste }}</pre>
        </span>
        <span
          class="inline-flex items-center gap-1.5 shrink-0 text-sm font-medium text-gray-900 dark:text-gray-100"
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

      <section class="mb-12" :aria-label="t.host.setups">
        <div
          role="tablist"
          :aria-label="t.host.setups"
          class="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700"
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
            class="px-3 py-2 -mb-px text-sm font-medium bg-transparent border-0 border-b-2 cursor-pointer font-sans"
            :class="
              activeGroup === tab.group
                ? 'border-primary text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
            "
            @click="activeGroup = tab.group"
          >
            {{ groupLabel(tab.group) }}
          </button>
        </div>
        <div
          role="tabpanel"
          :id="`catalog-tabpanel-${activeGroup}`"
          :aria-labelledby="`catalog-tab-${activeGroup}`"
        >
          <ul
            class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <li v-for="scene in activeScenes" :key="scene.id">
              <a
                :href="hrefFor(scene)"
                :data-testid="`scene-link-${scene.id}`"
                :aria-label="format(t.a11y.openScene, { name: scene.title })"
                class="group flex flex-col h-full overflow-hidden rounded-xl border border-gray-200 bg-white no-underline text-inherit transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
              >
                <SetupSketch v-if="scene.affordance" :kind="scene.affordance" />
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
        </div>
      </section>

      <section
        v-if="exampleScenes.length"
        aria-labelledby="catalog-group-examples"
      >
        <h2
          id="catalog-group-examples"
          class="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.04em] text-gray-600 dark:text-gray-300"
        >
          {{ t.host.groups.examples }}
        </h2>
        <ul
          class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <li v-for="scene in exampleScenes" :key="scene.id">
            <a
              :href="hrefFor(scene)"
              :data-testid="`scene-link-${scene.id}`"
              :aria-label="format(t.a11y.openScene, { name: scene.title })"
              class="group flex flex-col h-full overflow-hidden rounded-xl border border-gray-200 bg-white no-underline text-inherit transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
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
