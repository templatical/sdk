<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  buildAllCapabilityConfig,
  capabilityById,
} from "@/config/capabilities";
import { slugFor } from "@/providers/template-name";
import { templates } from "@/templates";
import CapabilityDrawer from "./CapabilityDrawer.vue";
import CapabilityRail from "./CapabilityRail.vue";
import { DRAWER_TABS } from "./drawer-tabs";
import { useCapabilityEditor } from "./useCapabilityEditor";
import { useCapabilityRoute } from "./useCapabilityRoute";
import { useControlState } from "./useControlState";
import { useDrawerChrome } from "./useDrawerChrome";
import { useEventLog } from "./useEventLog";

const { activeId, select } = useCapabilityRoute();
const { state: controlState, set: setControl } = useControlState();

// The drawer's chrome — open/collapsed, its height, and the active tab — is
// held and persisted by `useDrawerChrome`, under its own key rather than
// mixed into `controlState`.
const {
  open: drawerOpen,
  height: drawerHeight,
  activeTab: drawerActiveTab,
  setOpen: setDrawerOpen,
  setHeight: setDrawerHeight,
  commitHeight: commitDrawerHeight,
  setActiveTab: setDrawerActiveTab,
} = useDrawerChrome();

// The Events tab's feed. Held here, above the re-init cycle: the config is
// rebuilt on every control change, so a log living inside it would reset each
// time and a toggle would wipe the record of what the toggle just did.
const eventLog = useEventLog();

// `activeId` only ever holds a registered id — `parseCapabilityHash` (inside
// `useCapabilityRoute`) falls back to the first registered capability for
// anything else — so this lookup can't miss.
const capability = computed(() => capabilityById(activeId.value)!);

// The drawer's picker swaps the fixture for the current visit; `null` means
// "whatever this capability curated". Cleared on a capability change, so
// each one opens on its own fixture rather than inheriting the last pick.
const fixtureOverride = ref<string | null>(null);

// Every registered capability names "product-launch" today; a future one
// naming a fixture no template carries falls back to the first template
// rather than mounting an editor with no content at all.
const fixture = computed(() => {
  const wanted = fixtureOverride.value ?? capability.value.fixture;
  return templates.find((t) => slugFor(t.name) === wanted) ?? templates[0];
});

// The picker's value. Derived from the template that actually resolved, not
// from `fixtureOverride`, so the fallback above can never leave the select
// showing a slug it has no option for.
const fixtureSlug = computed(() => slugFor(fixture.value.name));

// The editor's host element, the instance in it, and the config it booted
// with all live in `useCapabilityEditor`, which also serializes re-inits:
// `unmount()` is keyed to the container, so overlapping `init()` calls tear
// down each other's app.
//
// Key order below is the Config tab's reading order — `renderConfig` prints
// `Object.entries`. The capability keys come first because they are what the
// drawer exists to demonstrate; `content` is a whole template's worth of
// blocks and buries anything after it (hundreds of lines against a ~10-line
// viewport). The three groups own disjoint keys, so moving the spread past
// `content` changes ordering and nothing else — pinned by the key-set
// assertion in `tests/config-build-all.test.ts`.
const {
  host: editorHost,
  lastInitConfig,
  initEditor,
  destroy,
} = useCapabilityEditor((container) => ({
  container,
  // `App.vue` also passes locale, theme, uiTheme, fonts, merge-tag request
  // handlers, test email and a dozen other keys. Those belong to
  // capabilities plans 5a-5d haven't ported yet — each arrives here as its
  // capability lands, so this shell only owns what the registry already
  // produces.
  //
  // `eventLog.record` itself, not an arrow closing over it: each capability
  // binds it to its own id, and one stable function keeps every rebuilt
  // config handing the feed the same target.
  ...buildAllCapabilityConfig(
    controlState.value,
    fixture.value,
    eventLog.record,
  ),
  content: fixture.value.create(),
}));

// Off the same table the bar renders, so a tab and its pane cannot diverge:
// pick a tab, get that tab's component. `DEFAULT_DRAWER_TAB` is registered
// (pinned in `tests/drawer-tabs.test.ts`) and `readDrawerState` refuses an
// unregistered id, so the fallback is unreachable rather than load-bearing.
const activeTabComponent = computed(
  () =>
    (
      DRAWER_TABS.find((tab) => tab.id === drawerActiveTab.value) ??
      DRAWER_TABS[0]
    ).component,
);

// One merged object for whichever pane is active: each pane picks out the
// props it declares, so `ControlsPane` sees `controls`/`state`/`fixture`,
// `ConfigPane` sees `config` and `EventsPane` sees `events`. That is what
// keeps the shell from growing a branch per tab, and reads as an oversight
// otherwise. Every pane sets `inheritAttrs: false`, because the entries a
// pane does not declare fall through onto its root element rather than being
// dropped.
const paneProps = computed(() => ({
  controls: capability.value.controls,
  state: controlState.value,
  fixture: fixtureSlug.value,
  config: lastInitConfig.value,
  events: eventLog.events.value,
}));

/**
 * Swap the fixture for this visit.
 *
 * Re-inits by calling `initEditor` rather than through a `watch(fixture)`:
 * a capability change clears the override, which moves `fixture` too, so a
 * watcher there would fire beside the `activeId` one and start a second
 * `init()` for a single click.
 */
function setFixture(slug: string): void {
  fixtureOverride.value = slug;
  void initEditor();
}

onMounted(async () => {
  await initEditor();
});

// A rail click or a direct link to a different `#capabilities/<id>` moves
// `activeId`. Re-running `initEditor` swaps the fixture and config into the
// SAME host element rather than remounting the component tree around it.
watch(activeId, async () => {
  // The picker's choice belongs to the capability it was made in, so each
  // capability opens on the fixture it curated (spec decision 9).
  fixtureOverride.value = null;
  await initEditor();
});

// The drawer's Controls tab writes through `useControlState()`'s `set()`,
// which replaces `controlState.value` outright rather than mutating it — a
// plain watch is enough to observe that, no `{ deep: true }` needed.
watch(controlState, async () => {
  await initEditor();
});

onBeforeUnmount(destroy);
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
        :tabs="DRAWER_TABS"
        :active-tab="drawerActiveTab"
        :open="drawerOpen"
        :height="drawerHeight"
        @update:active-tab="setDrawerActiveTab"
        @update:open="setDrawerOpen"
        @update:height="setDrawerHeight"
        @commit:height="commitDrawerHeight"
      >
        <component
          :is="activeTabComponent"
          v-bind="paneProps"
          @set="setControl"
          @update:fixture="setFixture"
          @clear="eventLog.clear"
        />
      </CapabilityDrawer>
    </div>
  </div>
</template>
