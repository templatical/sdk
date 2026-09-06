import type { Component } from "vue";
import ConfigPane from "./ConfigPane.vue";
import ControlsPane from "./ControlsPane.vue";
import EventsPane from "./EventsPane.vue";

export interface DrawerTab {
  id: string;
  label: string;
  component: Component;
  /**
   * An unread count for the tab bar to render as a small pill. `DRAWER_TABS`
   * itself never sets this — the static table has no notion of what is
   * unread — the shell derives a per-render copy with the Events tab's live
   * count attached.
   */
  badge?: number;
}

/**
 * The drawer's tabs, in bar order.
 *
 * The bar and the pane both read this array, so a tab cannot exist in one and
 * not the other: the pane renders `<component :is>` off the same entry the
 * button came from. A hand-written `v-if` chain per tab is what lets a new tab
 * silently render its neighbour's pane while `aria-selected` reports success.
 */
export const DRAWER_TABS: DrawerTab[] = [
  { id: "controls", label: "Controls", component: ControlsPane },
  { id: "config", label: "Config", component: ConfigPane },
  { id: "events", label: "Events", component: EventsPane },
];

/** The tab a drawer opens on before anyone has switched. */
export const DEFAULT_DRAWER_TAB = "controls";

export function isDrawerTabId(id: unknown): id is string {
  return typeof id === "string" && DRAWER_TABS.some((tab) => tab.id === id);
}
