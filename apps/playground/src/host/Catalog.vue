<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight } from "@lucide/vue";
import LogoIcon from "@/LogoIcon.vue";
import HostKnobs from "@/host/HostKnobs.vue";
import { sceneHref } from "@/host/sceneHref";
import { resolveInitialShadowMode } from "@/host/shadowMode";
import { format, usePlaygroundI18n } from "@/i18n";
import {
  getScene,
  SCENE_GROUP_ORDER,
  scenesByGroup,
  type Scene,
  type SceneGroup,
} from "@/scenes";

const { t } = usePlaygroundI18n();
const shadowMode = ref<"shadow" | "light">(resolveInitialShadowMode());

const minimum = getScene("minimum");
const grouped = scenesByGroup();

const SETUP_GROUPS: SceneGroup[] = SCENE_GROUP_ORDER.filter(
  (group) => group !== "minimum" && group !== "examples",
);

const setupSections = computed(() =>
  SETUP_GROUPS.flatMap((group) => {
    const scenes = grouped.get(group);
    if (!scenes?.length) return [];
    return [{ group, scenes }];
  }),
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
      class="flex flex-col items-stretch max-w-[720px] w-full mx-auto px-6 pt-16 pb-20"
    >
      <LogoIcon class="mb-5" />
      <h1
        class="m-0 mb-3 text-[22px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100"
      >
        {{ t.host.catalogTitle }}
      </h1>
      <p
        class="m-0 mb-10 max-w-[65ch] text-[15px] leading-relaxed text-gray-600 dark:text-gray-300"
      >
        {{ t.host.catalogSubtitle }}
      </p>

      <a
        v-if="minimum"
        :href="hrefFor(minimum)"
        data-testid="scene-link-minimum"
        data-catalog-hero
        :aria-label="format(t.a11y.openScene, { name: minimum.title })"
        class="group block mb-12 p-6 rounded-xl border border-gray-200 bg-white no-underline text-inherit transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
      >
        <p class="m-0 mb-2 font-mono text-xs text-gray-600 dark:text-gray-300">
          {{ minimum.id }}
        </p>
        <h2
          class="m-0 mb-2 text-lg font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100"
        >
          {{ minimum.title }}
        </h2>
        <p
          class="m-0 mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
        >
          {{ minimum.summary }}
        </p>
        <span
          class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100"
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

      <section
        v-for="section in setupSections"
        :key="section.group"
        class="mb-10"
        :aria-labelledby="`catalog-group-${section.group}`"
      >
        <h2
          :id="`catalog-group-${section.group}`"
          class="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.04em] text-gray-600 dark:text-gray-300"
        >
          {{ groupLabel(section.group) }}
        </h2>
        <ul
          class="m-0 p-0 list-none flex flex-col border-t border-gray-200 dark:border-gray-700"
        >
          <li
            v-for="scene in section.scenes"
            :key="scene.id"
            class="border-b border-gray-200 dark:border-gray-700"
          >
            <a
              :href="hrefFor(scene)"
              :data-testid="`scene-link-${scene.id}`"
              :aria-label="format(t.a11y.openScene, { name: scene.title })"
              class="group flex items-baseline justify-between gap-4 py-3 no-underline text-inherit rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span class="min-w-0">
                <span
                  class="block text-sm font-medium text-gray-900 dark:text-gray-100"
                  >{{ scene.title }}</span
                >
                <span
                  class="block mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300"
                  >{{ scene.summary }}</span
                >
              </span>
              <span
                class="shrink-0 font-mono text-xs text-gray-600 dark:text-gray-300"
                >{{ scene.id }}</span
              >
            </a>
          </li>
        </ul>
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
        <ul class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-3">
          <li v-for="scene in exampleScenes" :key="scene.id">
            <a
              :href="hrefFor(scene)"
              :data-testid="`scene-link-${scene.id}`"
              :aria-label="format(t.a11y.openScene, { name: scene.title })"
              class="group flex flex-col h-full p-4 rounded-xl border border-gray-200 bg-white no-underline text-inherit transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
            >
              <span
                class="font-mono text-xs text-gray-600 dark:text-gray-300"
                >{{ scene.id }}</span
              >
              <span
                class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ scene.title }}</span
              >
              <span
                class="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300"
                >{{ scene.summary }}</span
              >
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
