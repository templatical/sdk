<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import Catalog from "@/host/Catalog.vue";
import DataSourcePicker from "@/host/DataSourcePicker.vue";
import SceneHost from "@/host/SceneHost.vue";
import { fetchShare, ShareError } from "@/host/share";
import { usePlaygroundI18n, usePlaygroundTheme } from "@/i18n";
import { getScene, parsePlaygroundRoute } from "@/scenes";

const { t } = usePlaygroundI18n();
const { isDark } = usePlaygroundTheme();
provide("isDark", isDark);

const locPath = ref(window.location.pathname);
const locSearch = ref(window.location.search);

function syncPlaygroundLocation(): void {
  locPath.value = window.location.pathname;
  locSearch.value = window.location.search;
}

const playgroundRoute = computed(() =>
  parsePlaygroundRoute(locPath.value, locSearch.value),
);
const sceneRoute = computed(() =>
  playgroundRoute.value.kind === "scene" ? playgroundRoute.value : null,
);

type ShareGate = "idle" | "loading" | "not-found" | "error";
const shareGate = ref<ShareGate>("idle");

async function hydrateShareFromCatalog(): Promise<void> {
  if (playgroundRoute.value.kind !== "catalog") {
    shareGate.value = "idle";
    return;
  }
  const id = new URLSearchParams(locSearch.value).get("s");
  if (!id) {
    shareGate.value = "idle";
    return;
  }
  shareGate.value = "loading";
  try {
    const share = await fetchShare(id);
    const recorded =
      share.sceneId && getScene(share.sceneId) ? share.sceneId : "minimum";
    history.replaceState({}, "", `/scenes/${recorded}${locSearch.value}`);
    syncPlaygroundLocation();
    shareGate.value = "idle";
  } catch (err) {
    shareGate.value =
      err instanceof ShareError && err.code === "not-found"
        ? "not-found"
        : "error";
  }
}

watch(
  () => [playgroundRoute.value.kind, locSearch.value] as const,
  () => {
    void hydrateShareFromCatalog();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("popstate", syncPlaygroundLocation);
});

onUnmounted(() => {
  window.removeEventListener("popstate", syncPlaygroundLocation);
});
</script>

<template>
  <!--
    Keep one element root. main.ts wraps the page in a <Transition>, which
    cannot animate a fragment: a second root (the picker, say) disables the
    screen crossfade with nothing but a console warning.
  -->
  <div class="pg-app">
    <SceneHost
      v-if="sceneRoute"
      :key="sceneRoute.id"
      :scene-id="sceneRoute.id"
      :search="sceneRoute.search"
    />
    <main
      v-else-if="shareGate === 'loading'"
      data-testid="share-load"
      role="status"
      class="flex flex-col items-center justify-center min-h-screen gap-3 font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
    >
      <p class="m-0 text-sm text-gray-600 dark:text-gray-300">
        {{ t.sharedTemplate.loading }}
      </p>
    </main>
    <main
      v-else-if="shareGate === 'not-found' || shareGate === 'error'"
      data-testid="share-load-error"
      class="flex flex-col items-center justify-center min-h-screen gap-3 font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
    >
      <h1 class="m-0 text-base font-semibold">
        {{
          shareGate === "not-found"
            ? t.sharedTemplate.notFound
            : t.sharedTemplate.error
        }}
      </h1>
      <a href="/" class="pg-toolbar-btn no-underline">{{
        t.sharedTemplate.goToPlayground
      }}</a>
    </main>
    <Catalog v-else />
    <DataSourcePicker />
  </div>
</template>
