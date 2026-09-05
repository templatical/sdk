<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  init,
  type TemplaticalEditor,
  type TemplaticalEditorConfig,
} from "@templatical/editor";
import {
  buildAllCapabilityConfig,
  capabilityById,
} from "@/config/capabilities";
import { slugFor } from "@/providers/template-name";
import { templates } from "@/templates";
import CapabilityDrawer from "./CapabilityDrawer.vue";
import CapabilityRail from "./CapabilityRail.vue";
import ConfigPane from "./ConfigPane.vue";
import ControlsPane from "./ControlsPane.vue";
import { useCapabilityRoute } from "./useCapabilityRoute";
import { useControlState } from "./useControlState";

const { activeId, select } = useCapabilityRoute();
const { state: controlState, set: setControl } = useControlState();

// The drawer's own chrome — open/collapsed and its height — lives under a
// separate key from `controlState`. `tpl-playground-config` is capability
// control state and is seeded by e2e specs before navigation; mixing UI
// chrome into it would let a spec's seed clobber the user's drawer size.
const DRAWER_STATE_KEY = "tpl-playground-drawer";
const DRAWER_DEFAULT_HEIGHT = 280;

interface DrawerChromeState {
  open: boolean;
  height: number;
}

function readDrawerState(): DrawerChromeState {
  try {
    const raw = localStorage.getItem(DRAWER_STATE_KEY);
    if (!raw) return { open: true, height: DRAWER_DEFAULT_HEIGHT };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { open: true, height: DRAWER_DEFAULT_HEIGHT };
    }
    const { open, height } = parsed as Partial<DrawerChromeState>;
    return {
      open: typeof open === "boolean" ? open : true,
      height: typeof height === "number" ? height : DRAWER_DEFAULT_HEIGHT,
    };
  } catch {
    return { open: true, height: DRAWER_DEFAULT_HEIGHT };
  }
}

function writeDrawerState(next: DrawerChromeState): void {
  try {
    localStorage.setItem(DRAWER_STATE_KEY, JSON.stringify(next));
  } catch {
    // A private-mode or quota failure loses the setting for the next reload
    // only — the drawer keeps working from in-memory state this session.
  }
}

const drawerInitial = readDrawerState();
const drawerOpen = ref(drawerInitial.open);
const drawerHeight = ref(drawerInitial.height);
const drawerActiveTab = ref("controls");
const drawerTabs = [
  { id: "controls", label: "Controls" },
  { id: "config", label: "Config" },
];

function setDrawerOpen(open: boolean): void {
  drawerOpen.value = open;
  writeDrawerState({ open, height: drawerHeight.value });
}

function setDrawerHeight(height: number): void {
  drawerHeight.value = height;
  writeDrawerState({ open: drawerOpen.value, height });
}

// `activeId` only ever holds a registered id — `parseCapabilityHash` (inside
// `useCapabilityRoute`) falls back to the first registered capability for
// anything else — so this lookup can't miss.
const capability = computed(() => capabilityById(activeId.value)!);

// Every registered capability names "product-launch" today; a future one
// naming a fixture no template carries falls back to the first template
// rather than mounting an editor with no content at all.
const fixture = computed(
  () =>
    templates.find((t) => slugFor(t.name) === capability.value.fixture) ??
    templates[0],
);

const editorHost = ref<HTMLElement | null>(null);
const editor = ref<TemplaticalEditor | null>(null);

// The Config tab renders THIS object — the very one the mounted editor was
// handed, never a copy rebuilt for display. A second copy is free to drift
// from the call site (a key added to `init()` and forgotten here), and the
// tab's only value is that it cannot: what it shows is what booted.
// `shallowRef` keeps the object raw, so a provider's methods reach
// `renderConfig` as themselves rather than through a reactive proxy.
const lastInitConfig = shallowRef<TemplaticalEditorConfig | null>(null);

// Navigating away from #capabilities while `init()` is in flight must not
// mount a fresh editor after teardown: `onBeforeUnmount` tears down whatever
// `editor.value` holds at that moment, and assigning past it would land a new
// instance in a detached host with nothing left to unmount it. Set on
// unmount, checked after the one await below.
let destroyed = false;

// Two re-inits can be in flight at once — a rail click and a control toggle —
// and `init()` is async, so the later request must win regardless of which
// settles first. The token is captured per call and re-checked after the await;
// a superseded call unmounts what it built rather than assigning it.
let initToken = 0;

async function initEditor(): Promise<void> {
  if (!editorHost.value) return;
  const token = ++initToken;
  editor.value?.unmount();
  // One object, built once and used twice: handed to `init()` below and kept
  // in `lastInitConfig` for the Config tab. Do not rebuild it for display.
  const config: TemplaticalEditorConfig = {
    container: editorHost.value,
    content: fixture.value.create(),
    // `App.vue` also passes locale, theme, uiTheme, fonts, merge-tag request
    // handlers, test email and a dozen other keys. Those belong to
    // capabilities plans 5a-5d haven't ported yet — each arrives here as its
    // capability lands, so this shell only owns what the registry already
    // produces.
    ...buildAllCapabilityConfig(controlState.value, fixture.value),
  };
  const instance = await init(config);
  if (destroyed || token !== initToken) {
    instance.unmount();
    return;
  }
  editor.value = instance;
  // Written under the same staleness guard as `editor.value`, so a fast
  // capability switch cannot leave the panel describing a config that lost
  // the race and was never mounted.
  lastInitConfig.value = config;
}

onMounted(async () => {
  await initEditor();
});

// A rail click or a direct link to a different `#capabilities/<id>` moves
// `activeId`. Re-running `initEditor` swaps the fixture and config into the
// SAME host element rather than remounting the component tree around it.
watch(activeId, async () => {
  await initEditor();
});

// The drawer (later tasks) writes through `useControlState()`'s `set()`,
// which replaces `controlState.value` outright rather than mutating it — a
// plain watch is enough to observe that, no `{ deep: true }` needed.
watch(controlState, async () => {
  await initEditor();
});

onBeforeUnmount(() => {
  destroyed = true;
  editor.value?.unmount();
});
</script>

<template>
  <div data-testid="capability-shell" class="flex h-screen dark:bg-gray-900">
    <CapabilityRail :active-id="activeId" @select="select" />
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="shrink-0 border-b border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800"
      >
        <h1
          class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {{ capability.title }}
        </h1>
        <p
          data-testid="capability-blurb"
          class="m-0 mt-1 text-sm text-gray-500 dark:text-gray-400"
        >
          {{ capability.blurb }}
        </p>
      </header>
      <main
        class="relative flex min-h-0 flex-1 bg-gray-100 p-[15px] dark:bg-gray-800"
      >
        <div
          ref="editorHost"
          data-testid="capability-editor"
          class="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
        />
      </main>
      <CapabilityDrawer
        :tabs="drawerTabs"
        :active-tab="drawerActiveTab"
        :open="drawerOpen"
        :height="drawerHeight"
        @update:active-tab="drawerActiveTab = $event"
        @update:open="setDrawerOpen"
        @update:height="setDrawerHeight"
      >
        <ControlsPane
          v-if="drawerActiveTab === 'controls'"
          :controls="capability.controls"
          :state="controlState"
          @set="setControl"
        />
        <ConfigPane v-else :config="lastInitConfig" />
      </CapabilityDrawer>
    </div>
  </div>
</template>
