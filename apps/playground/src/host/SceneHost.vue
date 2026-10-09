<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from "vue";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CodeXml,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
} from "@lucide/vue";
import type { TemplaticalEditor } from "@templatical/editor";
import { useLocalStorage, useMediaQuery } from "@vueuse/core";
import CatalogRail from "@/host/CatalogRail.vue";
import CodeDrawer from "@/host/CodeDrawer.vue";
import ExportModal from "@/host/ExportModal.vue";
import HostKnobs from "@/host/HostKnobs.vue";
import ImportPastePanel from "@/host/ImportPastePanel.vue";
import SceneInitKey from "@/host/SceneInitKey.vue";
import SceneNotes from "@/host/SceneNotes.vue";
import SetupCard from "@/host/SetupCard.vue";
import ShareModal from "@/host/ShareModal.vue";
import {
  isPlainLeftClick,
  navigatePlayground,
  sceneHref,
} from "@/host/sceneHref";
import { createSerializedBoot } from "@/host/bootQueue";
import {
  codeSpans,
  localeLabel,
  plainText,
  sceneInitCode,
  sceneTitle,
} from "@/host/catalogNav";
import { proofFor } from "@/host/proofs";
import type { NotesMode } from "@/host/sceneNotes";
import { SHARE_LOAD_FAILED, SHARE_NOT_FOUND } from "@/host/share";
import { useSceneInit } from "@/host/useSceneInit";
import {
  format,
  ossSdkLocales,
  usePlaygroundI18n,
  usePlaygroundTheme,
} from "@/i18n";
import { getScene, sceneNeighbours, type Scene } from "@/scenes";

const props = defineProps<{
  sceneId: string;
  search: URLSearchParams;
}>();

const { t } = usePlaygroundI18n();

function titleOf(scene: Scene): string {
  return sceneTitle(scene, t.value.scenes);
}
const { theme: uiTheme } = usePlaygroundTheme();
const scene = computed(() => getScene(props.sceneId));
const editorContainer = ref<HTMLElement | null>(null);
const initError = ref("");
const sceneReady = ref(false);
// Remembered per browser: once opened, the snippet stays open across scenes.
const codeOpen = useLocalStorage("tpl-playground-code-open", false);
// Remembered per browser too; hiding the rail gives the editor its width.
const railOpen = useLocalStorage("tpl-playground-rail-open", true);
const neighbours = computed(() => sceneNeighbours(props.sceneId));
// The editor's own small-screen breakpoint (SMALL_SCREEN_QUERY): below it the
// editor covers itself with a notice, so a phone gets the setup as a card and
// no editor mounts at all. `?phoneCard=0` mounts the editor anyway, which is
// how the e2e suite reaches that notice and a custom block's mobile styles.
const belowEditorBreakpoint = useMediaQuery("(max-width: 767px)");
const isPhone = computed(
  () => belowEditorBreakpoint.value && props.search.get("phoneCard") !== "0",
);
const docsHref = computed(() =>
  scene.value ? `https://docs.templatical.com${scene.value.docs}` : "",
);
// The notes show by themselves once per browser, on the first scene that
// opens; the settings menu's "Show notes" brings them back on any scene.
const notesSeen = useLocalStorage("tpl-playground-notes-seen", false);
// A setup's own note shows once more, alone, on that setup's first visit.
const sceneNotesSeen = useLocalStorage<string[]>(
  "tpl-playground-scene-notes-seen",
  [],
);
const notesOpen = ref(false);
const notesMode = ref<NotesMode>("all");

interface SceneCopy {
  seeIt: string;
  note?: string;
}

const sceneCopy = computed<SceneCopy | undefined>(() => {
  const copies: Record<string, SceneCopy | undefined> = t.value.scenes;
  return copies[props.sceneId];
});
// Importers and examples keep their summary: what they show is the email.
const seeIt = computed(
  () => sceneCopy.value?.seeIt ?? scene.value?.summary ?? "",
);
const initCode = computed(() =>
  scene.value
    ? sceneInitCode(scene.value, t.value.host.minimumPaste)
    : undefined,
);
const picker = computed(() => scene.value?.valuePicker);
const pickedValue = computed(() => {
  const p = picker.value;
  return p ? (props.search.get(p.param) ?? p.fallback) : undefined;
});
// The editor's own list, so a locale a contributor adds shows up here
// without a playground edit (locale-switching.spec.ts holds it to the files).
const pickerOptions = computed(() =>
  picker.value?.values === "editor-locales"
    ? ossSdkLocales.map((code) => ({ value: code, label: localeLabel(code) }))
    : [],
);
const sceneSnippet = computed(() =>
  scene.value
    ? (scene.value.snippetFor?.({ search: props.search }) ??
      scene.value.snippet)
    : "",
);

function onPick(value: string): void {
  const p = picker.value;
  if (!p) return;
  navigatePlayground(
    sceneHref(
      props.sceneId,
      props.search,
      value === p.fallback ? {} : { [p.param]: value },
    ),
  );
}

const sceneNote = computed(() => {
  const pointer = scene.value?.pointer;
  const note = sceneCopy.value?.note;
  return pointer && note ? { pointer, note } : undefined;
});

/** The stored list, or none when storage holds something else. */
function seenScenes(): string[] {
  const seen: unknown = sceneNotesSeen.value;
  return Array.isArray(seen) ? seen : [];
}

function sceneNoteSeen(id: string): boolean {
  return seenScenes().includes(id);
}

function openNotes(mode: NotesMode): void {
  notesMode.value = mode;
  notesOpen.value = true;
  const id = props.sceneId;
  if (sceneNote.value && !sceneNoteSeen(id)) {
    sceneNotesSeen.value = [...seenScenes(), id];
  }
}
const codeButton = ref<HTMLButtonElement | null>(null);

function closeCode(): void {
  codeOpen.value = false;
  void nextTick(() => codeButton.value?.focus());
}
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
  if (!isPlainLeftClick(event)) return;
  event.preventDefault();
  navigatePlayground(catalogHref());
}

function pagerHref(target: Scene): string {
  return sceneHref(target.id, props.search);
}

function onPager(event: MouseEvent, target: Scene): void {
  if (!isPlainLeftClick(event)) return;
  event.preventDefault();
  navigatePlayground(pagerHref(target));
}

watch(uiTheme, (theme) => {
  editor.value?.setTheme(theme);
});

const boot = createSerializedBoot();

watch(
  () =>
    [
      props.sceneId,
      props.search.toString(),
      retryTick.value,
      isPhone.value,
    ] as const,
  () => {
    void boot.enqueue(async (isCurrent) => {
      const current = scene.value;
      // Notes belong to the scene they opened on.
      notesOpen.value = false;
      sceneReady.value = false;
      initError.value = "";
      editor.value?.unmount();
      editor.value = null;
      if (!current || !isCurrent()) return;
      if (isPhone.value) {
        // The card has nothing to load.
        sceneReady.value = true;
        return;
      }
      await nextTick();
      if (!isCurrent()) return;
      const container = editorContainer.value;
      if (!container) return;
      const result = await useSceneInit(current, container, {
        search: props.search,
      });
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

watch(sceneReady, (ready) => {
  if (!ready || !editor.value) return;
  if (!notesSeen.value) {
    notesSeen.value = true;
    openNotes("all");
  } else if (sceneNote.value && !sceneNoteSeen(props.sceneId)) {
    openNotes("scene");
  }
});

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
    :data-notes="notesOpen ? 'open' : undefined"
    class="flex font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
    :class="isPhone ? 'min-h-screen' : 'h-screen'"
  >
    <div v-if="!isPhone" class="pg-rail-slot" :data-open="railOpen">
      <CatalogRail id="catalog-rail" :current-id="scene.id" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        data-testid="scene-header"
        class="flex items-center justify-between h-14 px-4 bg-gray-100 shrink-0 z-[100] dark:bg-gray-800 gap-3"
        :class="{ 'sticky top-0': isPhone }"
      >
        <!-- Only the title block shrinks: a long see-it line would otherwise
             squeeze the controls before it and nudge the arrows. -->
        <div class="flex items-center gap-3 min-w-0">
          <button
            v-if="!isPhone"
            type="button"
            data-testid="toolbar-rail"
            class="pg-toolbar-icon-btn shrink-0"
            :title="railOpen ? t.host.hideRail : t.host.showRail"
            :aria-label="t.host.setups"
            :aria-expanded="railOpen"
            aria-controls="catalog-rail"
            @click="railOpen = !railOpen"
          >
            <PanelLeftClose
              v-if="railOpen"
              :size="16"
              :stroke-width="1.5"
              aria-hidden="true"
            />
            <PanelLeftOpen
              v-else
              :size="16"
              :stroke-width="1.5"
              aria-hidden="true"
            />
          </button>
          <a
            :href="catalogHref()"
            data-testid="toolbar-back"
            class="pg-toolbar-btn shrink-0 no-underline"
            :title="t.a11y.backToCatalog"
            :aria-label="t.a11y.backToCatalog"
            @click="onBack"
          >
            <ChevronLeft :size="16" :stroke-width="1.5" aria-hidden="true" />
            <span>{{ t.host.back }}</span>
          </a>
          <!-- Before the title, not after it: a title's width changes from
               scene to scene, and arrows placed after it would move out
               from under a pointer clicking through the scenes. -->
          <div class="pg-pager" data-testid="scene-pager">
            <a
              v-if="neighbours.previous"
              :href="pagerHref(neighbours.previous)"
              data-testid="scene-previous"
              class="pg-pager-btn"
              :title="
                format(t.host.pager.previous, {
                  name: titleOf(neighbours.previous),
                })
              "
              :aria-label="
                format(t.host.pager.previous, {
                  name: titleOf(neighbours.previous),
                })
              "
              @click="onPager($event, neighbours.previous)"
            >
              <ChevronLeft :size="16" :stroke-width="1.5" aria-hidden="true" />
            </a>
            <a
              v-else
              role="link"
              aria-disabled="true"
              data-testid="scene-previous"
              class="pg-pager-btn"
              :aria-label="t.host.pager.noPrevious"
            >
              <ChevronLeft :size="16" :stroke-width="1.5" aria-hidden="true" />
            </a>
            <a
              v-if="neighbours.next"
              :href="pagerHref(neighbours.next)"
              data-testid="scene-next"
              class="pg-pager-btn"
              :title="
                format(t.host.pager.next, { name: titleOf(neighbours.next) })
              "
              :aria-label="
                format(t.host.pager.next, { name: titleOf(neighbours.next) })
              "
              @click="onPager($event, neighbours.next)"
            >
              <ChevronRight :size="16" :stroke-width="1.5" aria-hidden="true" />
            </a>
            <a
              v-else
              role="link"
              aria-disabled="true"
              data-testid="scene-next"
              class="pg-pager-btn"
              :aria-label="t.host.pager.noNext"
            >
              <ChevronRight :size="16" :stroke-width="1.5" aria-hidden="true" />
            </a>
          </div>
          <!-- On a phone the card carries the title block. -->
          <div v-if="!isPhone" class="min-w-0">
            <div class="flex min-w-0 items-baseline gap-2">
              <h1
                class="m-0 min-w-0 truncate text-base font-semibold leading-tight text-gray-900 dark:text-gray-100"
              >
                {{ titleOf(scene) }}
              </h1>
              <SceneInitKey
                v-if="initCode"
                :code="initCode"
                :value="pickedValue"
                :options="pickerOptions"
                @pick="onPick"
              />
            </div>
            <p
              data-testid="scene-see-it"
              class="m-0 mt-0.5 truncate text-xs text-gray-600 dark:text-gray-400"
              :title="plainText(seeIt)"
            >
              <template v-for="(part, i) in codeSpans(seeIt)" :key="i"
                ><code v-if="part.code" class="font-mono">{{ part.text }}</code
                ><template v-else>{{ part.text }}</template></template
              >
            </p>
          </div>
        </div>
        <!-- No overflow clipping here: the settings popover hangs below. -->
        <div class="flex items-center gap-1 shrink-0">
          <template v-if="!isPhone">
            <a
              :href="docsHref"
              data-testid="toolbar-docs"
              target="_blank"
              rel="noopener noreferrer"
              class="pg-toolbar-link"
            >
              {{ t.host.docs }}
              <ArrowUpRight
                :size="14"
                :stroke-width="1.75"
                aria-hidden="true"
              />
            </a>
            <button
              type="button"
              data-testid="toolbar-share"
              class="pg-toolbar-btn pg-toolbar-btn-collapsible"
              :title="t.toolbar.share"
              :disabled="!editor"
              @click="shareOpen = true"
            >
              <Share2 :size="16" :stroke-width="1.5" aria-hidden="true" />
              <span class="pg-toolbar-btn-label">{{ t.toolbar.share }}</span>
            </button>
            <button
              type="button"
              data-testid="toolbar-export"
              class="pg-toolbar-btn pg-toolbar-btn-collapsible"
              :title="t.toolbar.export"
              :disabled="!editor"
              @click="exportOpen = true"
            >
              <Download :size="16" :stroke-width="1.5" aria-hidden="true" />
              <span class="pg-toolbar-btn-label">{{ t.toolbar.export }}</span>
            </button>
            <button
              type="button"
              ref="codeButton"
              data-testid="toolbar-code"
              class="pg-toolbar-primary ml-1"
              :aria-expanded="codeOpen"
              aria-controls="code-drawer"
              @click="codeOpen = !codeOpen"
            >
              <CodeXml :size="16" :stroke-width="1.75" aria-hidden="true" />
              {{ t.host.code }}
            </button>
          </template>
          <HostKnobs :notes="!isPhone" @show-notes="openNotes('all')" />
        </div>
      </header>
      <!--
      Gray well + rounded card. Do not add `isolate` — that traps the
      editor popover root (z 10000) so the playground header paints over
      dialogs.
    -->
      <div
        v-if="!isPhone"
        data-testid="editor-screen"
        class="flex flex-1 flex-col min-h-0 bg-gray-100 p-[15px] dark:bg-gray-800"
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
        <!-- The gap to the stage is the slot's margin, not a flex gap, so it
             grows with the drawer instead of appearing before it. -->
        <Transition name="pg-drawer">
          <div v-if="codeOpen" class="pg-code-drawer-slot">
            <div class="pg-code-drawer-clip">
              <CodeDrawer :snippet="sceneSnippet" @close="closeCode" />
            </div>
          </div>
        </Transition>
      </div>
      <SetupCard
        v-else
        :title="titleOf(scene)"
        :see-it="seeIt"
        :snippet="sceneSnippet"
        :docs-href="docsHref"
        :proof="proofFor(scene.id)"
        :proof-alt="format(t.host.phone.proofAlt, { name: titleOf(scene) })"
      >
        <template #init-key>
          <SceneInitKey
            v-if="initCode"
            :code="initCode"
            :value="pickedValue"
            :options="pickerOptions"
            @pick="onPick"
          />
        </template>
      </SetupCard>
      <ExportModal v-model:open="exportOpen" :editor="editor" />
      <ShareModal
        v-model:open="shareOpen"
        :editor="editor"
        :scene-id="scene.id"
      />
      <SceneNotes
        :open="notesOpen && sceneReady && !!editor"
        :mode="notesMode"
        :scene="sceneNote"
        @dismiss="notesOpen = false"
      />
    </div>
  </div>
</template>
