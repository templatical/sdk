<script setup lang="ts">
import { computed, inject, onMounted, ref, shallowRef, type Ref } from "vue";
import { useClipboard } from "@vueuse/core";
import { ArrowRight, Check, Copy } from "@lucide/vue";
import LogoIcon from "@/LogoIcon.vue";
import CatalogGroupMark from "@/host/CatalogGroupMark.vue";
import CatalogProofs from "@/host/CatalogProofs.vue";
import HostKnobs from "@/host/HostKnobs.vue";
import type { CodeTheme, HighlightedToken } from "@/host/codeHighlight";
import { proofFor } from "@/host/proofs";
import {
  isPlainLeftClick,
  navigatePlayground,
  sceneHref,
} from "@/host/sceneHref";
import { format, usePlaygroundI18n } from "@/i18n";
import { getScene, scenesByGroup, type Scene, type SceneGroup } from "@/scenes";

const { t } = usePlaygroundI18n();

const minimum = getScene("minimum");
const grouped = scenesByGroup();

type ListedGroup = Exclude<SceneGroup, "minimum">;

/** The integration ladder, typeset as the columns of a contents page. */
const LADDER: ListedGroup[] = ["configure", "personalization", "backend"];
const ladder = LADDER.map((group) => ({
  group,
  scenes: grouped.get(group) ?? [],
}));
const imports = grouped.get("import") ?? [];
const examples = grouped.get("examples") ?? [];

const { copy, copied } = useClipboard({ copiedDuring: 1600, legacy: true });
/** Which copy button fired last, so only that one shows the check. */
const lastCopied = ref<"install" | "snippet" | null>(null);

function copyText(target: "install" | "snippet", text: string): void {
  lastCopied.value = target;
  void copy(text);
}

function isCopied(target: "install" | "snippet"): boolean {
  return copied.value && lastCopied.value === target;
}

/** The hero shows the Minimum scene's own snippet, so it cannot drift. */
const minimalSnippet = minimum?.snippet ?? "";
const isDark = inject<Ref<boolean>>("isDark", ref(false));

/**
 * Highlighted exactly as the Code dialog highlights it. The grammar is
 * ~45 KB gzip, so it loads after first paint: the snippet renders plain,
 * then the colours land (no layout shift, only colour).
 */
const highlight = shallowRef<
  ((code: string, theme: CodeTheme) => HighlightedToken[]) | null
>(null);
const snippetTokens = computed<HighlightedToken[]>(() =>
  highlight.value
    ? highlight.value(minimalSnippet, isDark.value ? "dark" : "light")
    : [{ text: minimalSnippet }],
);

function groupLabel(group: SceneGroup): string {
  return t.value.host.groups[group];
}

function groupJob(group: ListedGroup): string {
  return t.value.host.groupJobs[group];
}

function hrefFor(scene: Scene): string {
  return sceneHref(scene.id, window.location.search);
}

/**
 * Plain left-clicks navigate in place; modified clicks keep the browser's
 * own behaviour (new tab, new window). `morph` names the element that grows
 * into the editor stage during the view transition.
 */
function openScene(
  event: MouseEvent,
  scene: Scene,
  morph?: HTMLElement | null,
): void {
  if (!isPlainLeftClick(event)) return;
  event.preventDefault();
  navigatePlayground(hrefFor(scene), { morphFrom: morph ?? null });
}

/** Example tiles grow their paper frame, not the caption under it. */
function openProof(event: MouseEvent, scene: Scene): void {
  const link = event.currentTarget as HTMLElement | null;
  openScene(event, scene, link?.querySelector<HTMLElement>("[data-proof]"));
}

/** Hero cards grow the whole card; it is all paper. */
function openHeroProof(event: MouseEvent, scene: Scene): void {
  openScene(event, scene, event.currentTarget as HTMLElement | null);
}

onMounted(() => {
  void import("@/host/codeHighlight").then((module) => {
    highlight.value = module.highlightJs;
  });
  // The scene host's Back link carries the scene's group as the hash, so a
  // return lands on that section instead of the top of the page.
  const target = window.location.hash.slice(1);
  if (target.startsWith("group-")) {
    document.getElementById(target)?.scrollIntoView({ block: "start" });
  }
});
</script>

<template>
  <main
    data-testid="catalog-screen"
    class="min-h-screen bg-white font-sans text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <div class="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
      <header class="flex items-center justify-between gap-4 py-5">
        <a
          href="/"
          class="flex items-center rounded-md text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <LogoIcon :size="36" decorative class="translate-y-[3px]" />
          <span class="text-base font-semibold tracking-[-0.01em]">{{
            t.host.brand
          }}</span>
          <span class="ml-1.5 text-base text-gray-500 dark:text-gray-400">{{
            t.host.catalogTitle
          }}</span>
        </a>
        <div class="flex items-center gap-5">
          <nav
            :aria-label="t.host.catalogNav"
            class="hidden items-center gap-5 text-sm md:flex [&_a]:text-gray-600 [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-gray-900 dark:[&_a]:text-gray-300 dark:[&_a:hover]:text-gray-100"
          >
            <a
              href="https://docs.templatical.com"
              target="_blank"
              rel="noopener noreferrer"
              >{{ t.toolbar.docs }}</a
            >
            <a
              href="https://github.com/templatical/sdk"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t.a11y.githubRepo"
              >GitHub</a
            >
          </nav>
          <HostKnobs />
        </div>
      </header>

      <section
        class="grid items-center gap-10 pb-16 pt-6 lg:grid-cols-12 lg:gap-12 lg:pb-24 lg:pt-10"
      >
        <div class="min-w-0 lg:col-span-5">
          <h1 class="m-0 text-balance text-display font-semibold">
            {{ t.host.headline }}
          </h1>
          <p
            class="m-0 mt-5 max-w-[34ch] text-pretty text-lede text-gray-600 dark:text-gray-300"
          >
            {{ t.host.lede }}
          </p>
          <div class="mt-9 flex min-w-0 flex-col items-start gap-4">
            <figure
              v-if="minimum"
              data-testid="catalog-setup"
              class="m-0 w-full min-w-0 max-w-[30rem] overflow-hidden rounded-[10px] border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
            >
              <figcaption class="sr-only">{{ t.host.snippetLabel }}</figcaption>
              <div
                data-testid="catalog-install"
                class="flex items-center justify-between gap-3 border-b border-gray-200 py-1.5 pl-3.5 pr-1.5 dark:border-gray-700"
              >
                <code class="font-mono text-xs text-gray-900 dark:text-gray-100"
                  ><span class="select-none text-gray-500" aria-hidden="true"
                    >$ </span
                  >{{ t.host.installCommand }}</code
                >
                <button
                  type="button"
                  data-testid="catalog-install-copy"
                  class="pg-copy-btn"
                  :aria-label="t.host.copyInstall"
                  @click="copyText('install', t.host.installCommand)"
                >
                  <Check
                    v-if="isCopied('install')"
                    :size="14"
                    :stroke-width="2"
                    aria-hidden="true"
                  />
                  <Copy
                    v-else
                    :size="14"
                    :stroke-width="1.75"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <div class="relative">
                <pre
                  data-testid="catalog-snippet"
                  class="m-0 overflow-x-auto py-3 pl-3.5 pr-10 font-mono text-xs leading-relaxed text-gray-900 dark:text-gray-100"
                ><code><span
                  v-for="(token, index) in snippetTokens"
                  :key="index"
                  :style="token.color ? { color: token.color } : undefined"
                >{{ token.text }}</span></code></pre>
                <button
                  type="button"
                  data-testid="catalog-snippet-copy"
                  class="pg-copy-btn absolute right-1.5 top-1.5 bg-gray-50 dark:bg-gray-800"
                  :aria-label="t.host.copySnippet"
                  @click="copyText('snippet', minimalSnippet)"
                >
                  <Check
                    v-if="isCopied('snippet')"
                    :size="14"
                    :stroke-width="2"
                    aria-hidden="true"
                  />
                  <Copy
                    v-else
                    :size="14"
                    :stroke-width="1.75"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <span class="sr-only" aria-live="polite">{{
                copied ? t.host.copied : ""
              }}</span>
            </figure>
            <a
              v-if="minimum"
              :href="hrefFor(minimum)"
              data-testid="scene-link-minimum"
              data-catalog-hero
              class="pg-cta group no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              @click="openScene($event, minimum)"
            >
              {{ t.host.runTheseLines }}
              <ArrowRight
                :size="16"
                :stroke-width="2"
                aria-hidden="true"
                class="transition-transform duration-150 ease-out-expo group-hover:translate-x-0.5"
              />
            </a>
          </div>
        </div>
        <div class="lg:col-span-7">
          <CatalogProofs @open="openHeroProof" />
        </div>
      </section>

      <section aria-labelledby="catalog-setups" class="pb-20">
        <h2 id="catalog-setups" class="sr-only">{{ t.host.setups }}</h2>
        <div class="grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          <section
            v-for="column in ladder"
            :id="`group-${column.group}`"
            :key="column.group"
            :aria-labelledby="`group-${column.group}-title`"
            class="scroll-mt-6"
          >
            <div
              class="flex items-center gap-3 border-b border-gray-300 pb-3 dark:border-gray-700"
            >
              <CatalogGroupMark :group="column.group" />
              <div class="min-w-0">
                <h3
                  :id="`group-${column.group}-title`"
                  class="m-0 text-heading font-semibold"
                >
                  {{ groupLabel(column.group) }}
                </h3>
                <p class="m-0 mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {{ groupJob(column.group) }}
                </p>
              </div>
            </div>
            <ul class="m-0 list-none p-0">
              <li
                v-for="scene in column.scenes"
                :key="scene.id"
                class="border-b border-gray-200 dark:border-gray-800"
              >
                <a
                  :href="hrefFor(scene)"
                  :data-testid="`scene-link-${scene.id}`"
                  :aria-label="format(t.a11y.openScene, { name: scene.title })"
                  class="-mx-2 flex items-start justify-between gap-4 rounded-md px-2 py-3 text-inherit no-underline transition-colors duration-150 ease-out-expo hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-gray-800"
                  @click="openScene($event, scene)"
                >
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">{{
                      scene.title
                    }}</span>
                    <span
                      class="mt-0.5 block text-xs text-gray-600 dark:text-gray-400"
                      >{{ scene.job }}</span
                    >
                  </span>
                  <code
                    v-if="scene.initKey"
                    data-testid="catalog-init-key"
                    class="shrink-0 pt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400"
                    >{{ scene.initKey }}</code
                  >
                </a>
              </li>
            </ul>
          </section>
        </div>

        <section
          id="group-import"
          aria-labelledby="group-import-title"
          class="mt-14 flex scroll-mt-6 flex-col gap-4 border-t border-gray-300 pt-6 md:flex-row md:items-center md:gap-12 dark:border-gray-700"
        >
          <div class="flex shrink-0 items-center gap-3 md:w-72">
            <CatalogGroupMark group="import" />
            <div class="min-w-0">
              <h3
                id="group-import-title"
                class="m-0 text-heading font-semibold"
              >
                {{ groupLabel("import") }}
              </h3>
              <p class="m-0 mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                {{ groupJob("import") }}
              </p>
            </div>
          </div>
          <ul class="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
            <li v-for="scene in imports" :key="scene.id">
              <a
                :href="hrefFor(scene)"
                :data-testid="`scene-link-${scene.id}`"
                :aria-label="format(t.a11y.openScene, { name: scene.title })"
                class="rounded-sm text-sm font-medium text-gray-700 underline decoration-gray-300 decoration-1 underline-offset-4 transition-colors duration-150 hover:text-gray-900 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-300 dark:decoration-gray-600 dark:hover:text-gray-100"
                @click="openScene($event, scene)"
                >{{ scene.title }}</a
              >
            </li>
          </ul>
        </section>
      </section>
    </div>

    <section
      id="group-examples"
      aria-labelledby="group-examples-title"
      class="bg-table py-16 lg:py-20"
    >
      <div class="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
        <div class="flex items-center gap-3">
          <CatalogGroupMark group="examples" />
          <div class="min-w-0">
            <h2
              id="group-examples-title"
              class="m-0 text-heading font-semibold"
            >
              {{ groupLabel("examples") }}
            </h2>
            <p class="m-0 mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {{ groupJob("examples") }}
            </p>
          </div>
        </div>
        <ul
          class="m-0 mt-8 grid list-none grid-cols-2 gap-x-5 gap-y-10 p-0 md:grid-cols-4 md:gap-x-6"
        >
          <li v-for="scene in examples" :key="scene.id">
            <a
              :href="hrefFor(scene)"
              :data-testid="`scene-link-${scene.id}`"
              :aria-label="format(t.a11y.openScene, { name: scene.title })"
              class="pg-proof-link block rounded-lg text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-table"
              @click="openProof($event, scene)"
            >
              <span
                data-proof
                data-testid="catalog-proof-tile"
                class="pg-proof-tile block aspect-[3/4] overflow-hidden rounded-[7px] border border-gray-200 bg-white dark:border-gray-700"
              >
                <img
                  v-if="proofFor(scene.id)"
                  data-testid="catalog-proof"
                  :src="proofFor(scene.id)!.src"
                  :width="proofFor(scene.id)!.width"
                  :height="proofFor(scene.id)!.height"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="block h-auto w-full"
                />
              </span>
              <span class="mt-3 block text-sm font-medium">{{
                scene.title
              }}</span>
              <span
                class="mt-0.5 block text-xs text-gray-600 dark:text-gray-400"
                >{{ scene.job }}</span
              >
            </a>
          </li>
        </ul>
      </div>
    </section>

    <footer
      class="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6"
    >
      <span class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <LogoIcon :size="20" decorative />
        {{ t.host.brand }}
      </span>
      <nav
        :aria-label="t.host.catalogFooter"
        class="flex items-center gap-5 [&_a]:text-gray-600 [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-gray-900 dark:[&_a]:text-gray-300 dark:[&_a:hover]:text-gray-100"
      >
        <a
          href="https://docs.templatical.com"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t.toolbar.docs }}</a
        >
        <a
          href="https://github.com/templatical/sdk"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t.a11y.githubRepo"
          >GitHub</a
        >
      </nav>
    </footer>
  </main>
</template>
