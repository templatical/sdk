<script setup lang="ts">
import { computed, ref, watch, type Component } from "vue";
import { ChevronRight } from "@lucide/vue";
import CatalogGroupMark from "@/host/CatalogGroupMark.vue";
import { SCENE_ICONS } from "@/host/catalogIcons";
import { RAIL_NAV_GROUPS } from "@/host/catalogNav";
import {
  isPlainLeftClick,
  navigatePlayground,
  sceneHref,
} from "@/host/sceneHref";
import { usePlaygroundI18n } from "@/i18n";
import { getScene, scenesByGroup, type Scene, type SceneGroup } from "@/scenes";

const props = defineProps<{
  currentId: string;
}>();

const { t } = usePlaygroundI18n();
const grouped = scenesByGroup();
const current = computed(() => getScene(props.currentId));
const expandedGroup = ref<SceneGroup | null>(current.value?.group ?? null);

watch(
  () => current.value?.group,
  (group) => {
    if (group) expandedGroup.value = group;
  },
);

/**
 * A one-scene group is listed as its row alone, with no heading: a heading
 * that opens onto a single row of the same name says nothing. That is
 * Minimum today.
 */
const sections = computed(() =>
  RAIL_NAV_GROUPS.flatMap((group) => {
    const scenes = grouped.get(group);
    if (!scenes?.length) return [];
    return [{ group, scenes, heading: scenes.length > 1 }];
  }),
);

function groupLabel(group: SceneGroup): string {
  return t.value.host.groups[group];
}

function iconFor(scene: Scene): Component | undefined {
  return SCENE_ICONS[scene.id];
}

/** The code a row stands for: its init() key, or the whole call for Minimum. */
function codeFor(scene: Scene): string | undefined {
  return scene.group === "minimum" ? t.value.host.minimumPaste : scene.initKey;
}

function hrefFor(scene: Scene): string {
  return sceneHref(scene.id, window.location.search);
}

function onSceneClick(event: MouseEvent, scene: Scene): void {
  if (!isPlainLeftClick(event)) return;
  event.preventDefault();
  if (scene.id === props.currentId) return;
  navigatePlayground(hrefFor(scene));
}

function toggleGroup(group: SceneGroup): void {
  expandedGroup.value = expandedGroup.value === group ? null : group;
}
</script>

<template>
  <nav
    data-testid="catalog-rail"
    class="pg-catalog-nav flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
    :aria-label="t.host.setups"
  >
    <section v-for="section in sections" :key="section.group">
      <button
        v-if="section.heading"
        type="button"
        :id="`catalog-tab-${section.group}`"
        :data-testid="`catalog-tab-${section.group}`"
        :aria-expanded="expandedGroup === section.group"
        :aria-controls="`rail-panel-${section.group}`"
        class="pg-rail-heading"
        @click="toggleGroup(section.group)"
      >
        <CatalogGroupMark :group="section.group" size="sm" />
        <span class="min-w-0 flex-1 truncate">{{
          groupLabel(section.group)
        }}</span>
        <ChevronRight
          :size="14"
          :stroke-width="1.75"
          aria-hidden="true"
          class="pg-rail-heading-chevron"
        />
      </button>
      <!-- Always rendered, so opening and closing can animate (style.css).
           A closed panel ends up visibility: hidden, which takes its rows
           out of the tab order and the accessibility tree. -->
      <div
        :class="section.heading ? 'pg-rail-panel' : undefined"
        :data-open="
          section.heading ? expandedGroup === section.group : undefined
        "
      >
        <div :class="section.heading ? 'min-h-0 overflow-hidden' : undefined">
          <ul
            :id="`rail-panel-${section.group}`"
            class="m-0 flex list-none flex-col gap-px p-0"
            :class="section.heading ? 'pb-1.5 pt-0.5' : undefined"
          >
            <li v-for="item in section.scenes" :key="item.id">
              <a
                :href="hrefFor(item)"
                :data-testid="`rail-scene-${item.id}`"
                :aria-current="item.id === currentId ? 'page' : undefined"
                class="pg-rail-row"
                @click="onSceneClick($event, item)"
              >
                <span class="pg-rail-row-icon">
                  <component
                    :is="iconFor(item)"
                    v-if="iconFor(item)"
                    :size="14"
                    :stroke-width="1.75"
                    aria-hidden="true"
                  />
                </span>
                <span class="min-w-0">
                  <span class="block truncate">{{ item.title }}</span>
                  <code v-if="codeFor(item)" class="pg-rail-row-code">{{
                    codeFor(item)
                  }}</code>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </nav>
</template>
