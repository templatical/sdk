<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import {
  buildAllCapabilityConfig,
  capabilityById,
  resolveControlState,
} from "@/config/capabilities";
import { SHADOW_DOM_PATH } from "@/config/capabilities/shadow-dom";
import type { ControlState } from "@/config/types";
import { PLAYGROUND_USER } from "@/providers/identity";
import CapabilityDrawer from "./CapabilityDrawer.vue";
import CapabilityRail from "./CapabilityRail.vue";
import { DRAWER_TABS } from "./drawer-tabs";
import { fixtureCapabilityConfig } from "./fixture-config";
import { useCapabilityEditor } from "./useCapabilityEditor";
import { useCapabilityFixture } from "./useCapabilityFixture";
import { useCapabilityRoute } from "./useCapabilityRoute";
import { useControlState } from "./useControlState";
import { useDrawerChrome } from "./useDrawerChrome";
import { useEventLog } from "./useEventLog";

const { activeId, select } = useCapabilityRoute();
const { state: controlState, set: setControl } = useControlState();

/**
 * `?shadowDom=1|0|true|false` in the URL, expressed in the control's own
 * "shadow" | "light" vocabulary rather than a boolean. Mirrors the parsing
 * `App.vue`'s `readShadowDomFlag` does for its own mount-mode resolution —
 * this shell has a separate route and a separate control-state key, but
 * decision 22's resolution order (URL param beats control state beats
 * default) has to hold here too, since `playwright.config.ts`'s two projects
 * pin the mode by appending exactly this param.
 *
 * Read once at setup: this is a query-string value, and nothing in the shell
 * mutates `location.search` mid-session — only the hash changes on
 * navigation, which is a different part of the URL.
 */
function readShadowDomUrlOverride(): "shadow" | "light" | undefined {
  const v = new URLSearchParams(window.location.search).get("shadowDom");
  if (v === "1" || v === "true") return "shadow";
  if (v === "0" || v === "false") return "light";
  return undefined;
}
const shadowDomUrlOverride = readShadowDomUrlOverride();

/**
 * `controlState`, with the URL override folded onto `shadowDom.mode` when one
 * is present. Every capability's config is built from this rather than the
 * raw ref, so the override actually reaches `init()` — not just the `:key`
 * below — and the two can never disagree about which mode is live.
 *
 * The Controls tab keeps showing the raw stored value: the URL param exists
 * for the Playwright project matrix, not as an end-user-facing control-state
 * tier, so there is no "forced" row to render for it.
 */
const effectiveControlState = computed<ControlState>(() =>
  shadowDomUrlOverride === undefined
    ? controlState.value
    : { ...controlState.value, [SHADOW_DOM_PATH]: shadowDomUrlOverride },
);

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

// The bar's own copy of the tab table, with the Events tab's live unread
// count attached. Derived rather than mutating `DRAWER_TABS` itself, so the
// static table stays plain for every other reader of it (the pane's
// `activeTabComponent` lookup, the unit tests over `DRAWER_TABS` directly).
const tabsWithBadges = computed(() =>
  DRAWER_TABS.map((tab) =>
    tab.id === "events" ? { ...tab, badge: eventLog.unreadCount.value } : tab,
  ),
);

// `activeId` only ever holds a registered id — `parseCapabilityHash` (inside
// `useCapabilityRoute`) falls back to the first registered capability for
// anything else — so this lookup can't miss.
const capability = computed(() => capabilityById(activeId.value)!);

// Which template this capability shows, and the stored template the editor
// saves into — `useCapabilityFixture` owns both, because the second is keyed
// by the first.
//
// `initEditor` is reached through a thunk rather than passed directly: the
// editor lifecycle below needs `fixture` to build its config, so the two
// cannot both be constructed with the other already in hand. Only
// `setFixture` calls it, and that happens long after setup.
const { fixture, fixtureSlug, setFixture, adoptTemplate } =
  useCapabilityFixture(
    activeId,
    computed(() => capability.value.fixture),
    () => initEditor(),
  );

// `attachShadow()` is irreversible: once it has run on an element, the
// shadow root is permanent and the now-empty tree suppresses light-DOM
// children even after unmount. So a mount-mode change needs a NEW element,
// which is what keying the host on this forces — every other re-init
// (capability switch, tab switch, any other control) keeps the same node,
// which is the invariant `capability-shell.spec.ts` asserts. Resolved from
// `effectiveControlState`, never the raw `controlState`, so a URL-forced mode
// keys the host the same way it configures `init()` below.
const shadowMode = computed(
  () =>
    resolveControlState(effectiveControlState.value)[SHADOW_DOM_PATH] as string,
);

// The editor's host element, the instance in it, and the config it booted
// with all live in `useCapabilityEditor`, which also serializes re-inits:
// `unmount()` is keyed to the container, so overlapping `init()` calls tear
// down each other's app.
//
// Key order below is the Config tab's reading order — `renderConfig` prints
// `Object.entries`. The capability keys come first because they are what the
// drawer exists to demonstrate; `content` is a whole template's worth of
// blocks and buries anything after it (hundreds of lines against a ~10-line
// viewport). The groups own disjoint keys, so moving a spread past `content`
// changes ordering and nothing else — the capability registry's own key set
// is pinned by the assertion in `tests/config-build-all.test.ts`.
const {
  host: editorHost,
  lastInitConfig,
  initEditor,
  destroy,
} = useCapabilityEditor(
  (container) => ({
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
      effectiveControlState.value,
      fixture.value,
      eventLog.record,
    ),
    // `customBlocks` and `displayConditions`: not a capability's key, but the
    // fixture's own content needs them regardless — every fixture's custom
    // block and display-condition blocks render broken without them (see
    // `fixtureCapabilityConfig`). Placed ahead of `user`/`content` so they
    // stay above the fold in the Config tab like the capability keys above.
    ...fixtureCapabilityConfig(fixture.value),
    // Comments' `isAvailable` requires an identity (CLAUDE.md's "Provider
    // contracts" section: with no `user` the trigger and panel never render,
    // since an unattributable comment is worse than no comment feature). Set
    // unconditionally rather than only on the comments capability's own page,
    // because every page merges the whole registry's config the same way
    // `content` below is the whole template regardless of which capability
    // is active.
    user: PLAYGROUND_USER,
    content: fixture.value.create(),
  }),
  adoptTemplate,
);

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

onMounted(async () => {
  await initEditor();
});

// A rail click or a direct link to a different `#capabilities/<id>` moves
// `activeId`. Re-running `initEditor` swaps the fixture and config into the
// SAME host element rather than remounting the component tree around it.
// `useCapabilityFixture` watches `activeId` too, to clear the picker's
// override. Its watcher is created first, so the override is already cleared
// by the time this one re-inits.
watch(activeId, async () => {
  await initEditor();
});

// The drawer's Controls tab writes through `useControlState()`'s `set()`,
// which replaces `controlState.value` outright rather than mutating it — a
// plain watch is enough to observe that, no `{ deep: true }` needed.
watch(controlState, async () => {
  await initEditor();
});

// Reading the feed means switching to it — `immediate` covers the case where
// the drawer restored to the Events tab on mount, so an unread count is never
// left sitting there under the reader's eyes.
watch(
  drawerActiveTab,
  (id) => {
    if (id === "events") eventLog.markRead();
  },
  { immediate: true },
);

// A new event landing while Events is already the active tab must not badge
// the tab the reader is currently looking at.
watch(eventLog.events, () => {
  if (drawerActiveTab.value === "events") eventLog.markRead();
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
          :key="shadowMode"
          data-testid="capability-editor"
          class="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
        />
      </main>
      <CapabilityDrawer
        :tabs="tabsWithBadges"
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
