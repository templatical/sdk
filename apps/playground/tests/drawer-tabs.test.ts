import { describe, expect, it } from "vitest";
import ConfigPane from "../src/shell/ConfigPane.vue";
import ControlsPane from "../src/shell/ControlsPane.vue";
import EventsPane from "../src/shell/EventsPane.vue";
import ExportPane from "../src/shell/ExportPane.vue";
import {
  DRAWER_TABS,
  DEFAULT_DRAWER_TAB,
  isDrawerTabId,
} from "../src/shell/drawer-tabs";

/**
 * The drawer's tabs come from one table, read by both the bar and the pane.
 *
 * A hand-written `v-if` chain per tab is what lets a new tab silently render
 * its neighbour's pane: `aria-selected` flips, the content does not change,
 * and nothing fails. Every guarantee below is what makes that impossible.
 */

describe("DRAWER_TABS", () => {
  it("is the one source of both the bar and the pane", () => {
    expect(DRAWER_TABS.map((t) => t.id)).toEqual([
      "controls",
      "config",
      "events",
      "export",
    ]);
  });

  it("gives every tab a component, so no tab can fall through to another's pane", () => {
    const componentless = DRAWER_TABS.filter((t) => !t.component).map(
      (t) => t.id,
    );
    expect(componentless).toEqual([]);
  });

  it("maps each id to its own pane, so no two tabs share one", () => {
    // By identity: a table pointing Config at the Controls pane still holds
    // two entries and would satisfy any count-based check, while the drawer
    // would render Controls under both tabs.
    const componentFor = (id: string) =>
      DRAWER_TABS.find((tab) => tab.id === id)?.component;
    expect(componentFor("controls")).toBe(ControlsPane);
    expect(componentFor("config")).toBe(ConfigPane);
    expect(componentFor("events")).toBe(EventsPane);
    expect(componentFor("export")).toBe(ExportPane);
  });

  it("gives every pane inheritAttrs: false, since the shell binds one merged prop bag", () => {
    // The shell hands every pane the same object — one branch, not one per
    // tab. A pane that inherits attrs renders the other panes' props onto its
    // root element as `[object Object]`.
    const leaky = DRAWER_TABS.filter(
      (tab) =>
        (tab.component as { inheritAttrs?: boolean }).inheritAttrs !== false,
    ).map((tab) => tab.id);
    expect(leaky).toEqual([]);
  });

  it("gives every tab a distinct id and a non-empty label", () => {
    expect(new Set(DRAWER_TABS.map((t) => t.id)).size).toBe(DRAWER_TABS.length);
    expect(DRAWER_TABS.filter((t) => t.label.trim() === "")).toEqual([]);
  });

  it("defaults to a tab that exists", () => {
    expect(DRAWER_TABS.map((t) => t.id)).toContain(DEFAULT_DRAWER_TAB);
  });

  it("recognises only registered ids", () => {
    expect(isDrawerTabId("controls")).toBe(true);
    expect(isDrawerTabId("events")).toBe(true);
    // A tab id outlives the build that stored it, so one no longer in the
    // table must be refused rather than left pointing at nothing.
    expect(isDrawerTabId("gone")).toBe(false);
    expect(isDrawerTabId(null)).toBe(false);
  });
});
