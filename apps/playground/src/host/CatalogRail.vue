<script setup lang="ts">
import { computed, ref, watch, type Component } from "vue";
import { ChevronRight } from "@lucide/vue";
import { SCENE_ICONS } from "@/host/catalogIcons";
import { RAIL_NAV_GROUPS } from "@/host/catalogNav";
import { navigatePlayground, sceneHref } from "@/host/sceneHref";
import { usePlaygroundI18n } from "@/i18n";
import { getScene, scenesByGroup, type Scene, type SceneGroup } from "@/scenes";

const props = defineProps<{
  currentId: string;
}>();

const { t } = usePlaygroundI18n();
const grouped = scenesByGroup();
const current = computed(() => getScene(props.currentId));
const expandedGroup = ref<SceneGroup>(current.value?.group ?? "configure");

watch(
  () => current.value?.group,
  (group) => {
    if (group) expandedGroup.value = group;
  },
);

const sections = computed(() =>
  RAIL_NAV_GROUPS.flatMap((group) => {
    const scenes = grouped.get(group);
    if (!scenes?.length) return [];
    return [{ group, scenes }];
  }),
);

function groupLabel(group: SceneGroup): string {
  return t.value.host.groups[group];
}

function groupJob(group: SceneGroup): string {
  if (group === "minimum") return t.value.host.minimumPaste;
  return t.value.host.groupJobs[group];
}

function iconFor(scene: Scene): Component | undefined {
  return SCENE_ICONS[scene.id];
}

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
  if (scene.id === props.currentId) return;
  navigatePlayground(hrefFor(scene));
}

function toggleGroup(group: SceneGroup): void {
  expandedGroup.value = group;
}
</script>

<template>
  <nav
    data-testid="catalog-rail"
    class="pg-catalog-nav flex w-56 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
    :aria-label="t.host.setups"
  >
    <section v-for="section in sections" :key="section.group">
      <button
        type="button"
        :id="`catalog-tab-${section.group}`"
        :data-testid="`catalog-tab-${section.group}`"
        :aria-expanded="expandedGroup === section.group"
        :aria-controls="`rail-panel-${section.group}`"
        class="flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-left cursor-pointer font-sans transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        :class="
          expandedGroup === section.group
            ? 'catalog-tab-active border border-primary/30 bg-primary/10 text-gray-900 dark:border-primary/40 dark:bg-primary/15 dark:text-gray-100'
            : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600'
        "
        @click="toggleGroup(section.group)"
      >
        <span class="min-w-0 flex-1">
          <span
            class="block text-sm"
            :class="
              expandedGroup === section.group ? 'font-semibold' : 'font-medium'
            "
            >{{ groupLabel(section.group) }}</span
          >
          <span
            class="block mt-0.5 text-xs leading-snug text-gray-600 dark:text-gray-400"
            >{{ groupJob(section.group) }}</span
          >
        </span>
        <ChevronRight
          :size="14"
          :stroke-width="1.75"
          aria-hidden="true"
          class="shrink-0 transition-transform duration-150"
          :class="
            expandedGroup === section.group
              ? 'rotate-90 text-primary'
              : 'text-gray-400 dark:text-gray-500'
          "
        />
      </button>
      <ul
        v-if="expandedGroup === section.group"
        :id="`rail-panel-${section.group}`"
        class="m-0 mt-1 p-0 list-none flex flex-col gap-0.5"
      >
        <li v-for="item in section.scenes" :key="item.id">
          <a
            :href="hrefFor(item)"
            :data-testid="`rail-scene-${item.id}`"
            :aria-current="item.id === currentId ? 'page' : undefined"
            class="flex items-center gap-2 px-3 py-2 rounded-md text-sm no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="
              item.id === currentId
                ? 'bg-primary/10 font-medium text-gray-900 dark:bg-primary/15 dark:text-gray-100'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
            "
            @click="onSceneClick($event, item)"
          >
            <component
              :is="iconFor(item)"
              v-if="iconFor(item)"
              :size="14"
              :stroke-width="1.75"
              aria-hidden="true"
              class="shrink-0 text-primary dark:text-primary-dark"
            />
            <span class="truncate">{{ item.title }}</span>
          </a>
        </li>
      </ul>
    </section>
  </nav>
</template>
