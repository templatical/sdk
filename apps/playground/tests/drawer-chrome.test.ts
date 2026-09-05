import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampDrawerHeight,
  DRAWER_DEFAULT_HEIGHT,
  DRAWER_MAX_HEIGHT,
  DRAWER_MIN_HEIGHT,
  DRAWER_STATE_KEY,
  readDrawerState,
  writeDrawerState,
} from "../src/shell/drawer-chrome";
import { DEFAULT_DRAWER_TAB } from "../src/shell/drawer-tabs";

/**
 * The drawer is `shrink-0` and `<main>` above it is `flex-1 min-h-0`, so a
 * height outside the bounds does not merely look wrong: it collapses the
 * editor to zero and the page renders a drawer with nothing above it. The
 * bounds are enforced on the way in from storage, not only during a drag,
 * because what is in storage is JSON somebody else may have written.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("clampDrawerHeight", () => {
  it("passes an in-range height through untouched", () => {
    expect(clampDrawerHeight(280)).toBe(280);
    expect(clampDrawerHeight(DRAWER_MIN_HEIGHT)).toBe(DRAWER_MIN_HEIGHT);
    expect(clampDrawerHeight(DRAWER_MAX_HEIGHT)).toBe(DRAWER_MAX_HEIGHT);
  });

  it("pulls a height below the minimum up to it", () => {
    expect(clampDrawerHeight(0)).toBe(DRAWER_MIN_HEIGHT);
    expect(clampDrawerHeight(-9000)).toBe(DRAWER_MIN_HEIGHT);
    expect(clampDrawerHeight(DRAWER_MIN_HEIGHT - 1)).toBe(DRAWER_MIN_HEIGHT);
  });

  it("pulls a height above the maximum down to it", () => {
    expect(clampDrawerHeight(5000)).toBe(DRAWER_MAX_HEIGHT);
    expect(clampDrawerHeight(DRAWER_MAX_HEIGHT + 1)).toBe(DRAWER_MAX_HEIGHT);
  });

  it("keeps the bounds ordered and the default inside them", () => {
    expect(DRAWER_MIN_HEIGHT).toBeLessThan(DRAWER_MAX_HEIGHT);
    expect(clampDrawerHeight(DRAWER_DEFAULT_HEIGHT)).toBe(
      DRAWER_DEFAULT_HEIGHT,
    );
  });
});

describe("readDrawerState", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(readDrawerState()).toEqual({
      open: true,
      height: DRAWER_DEFAULT_HEIGHT,
      activeTab: DEFAULT_DRAWER_TAB,
    });
  });

  it("returns a stored, in-range state verbatim", () => {
    localStorage.setItem(
      DRAWER_STATE_KEY,
      JSON.stringify({ open: false, height: 296 }),
    );
    expect(readDrawerState()).toEqual({
      open: false,
      height: 296,
      activeTab: DEFAULT_DRAWER_TAB,
    });
  });

  it("clamps a stored height above the maximum", () => {
    localStorage.setItem(
      DRAWER_STATE_KEY,
      JSON.stringify({ open: true, height: 5000 }),
    );
    expect(readDrawerState()).toEqual({
      open: true,
      height: DRAWER_MAX_HEIGHT,
      activeTab: DEFAULT_DRAWER_TAB,
    });
  });

  it("clamps a stored height below the minimum", () => {
    localStorage.setItem(
      DRAWER_STATE_KEY,
      JSON.stringify({ open: true, height: 1 }),
    );
    expect(readDrawerState()).toEqual({
      open: true,
      height: DRAWER_MIN_HEIGHT,
      activeTab: DEFAULT_DRAWER_TAB,
    });
  });

  it("falls back to the default height for a non-finite number", () => {
    // `NaN` is a `number`, and clamping it yields `NaN` — which reaches the
    // template as `height: NaNpx` and is dropped, leaving the drawer
    // content-sized. Finiteness is checked before the clamp for that reason.
    localStorage.setItem(DRAWER_STATE_KEY, '{"open":true,"height":null}');
    expect(readDrawerState().height).toBe(DRAWER_DEFAULT_HEIGHT);
  });

  it("falls back per field for a wrongly-typed value", () => {
    localStorage.setItem(
      DRAWER_STATE_KEY,
      JSON.stringify({ open: "yes", height: "480" }),
    );
    expect(readDrawerState()).toEqual({
      open: true,
      height: DRAWER_DEFAULT_HEIGHT,
      activeTab: DEFAULT_DRAWER_TAB,
    });
  });

  it("returns the defaults for unparseable JSON", () => {
    localStorage.setItem(DRAWER_STATE_KEY, "{not json");
    expect(readDrawerState()).toEqual({
      open: true,
      height: DRAWER_DEFAULT_HEIGHT,
      activeTab: DEFAULT_DRAWER_TAB,
    });
  });

  it("returns the defaults for a JSON value that is not an object", () => {
    localStorage.setItem(DRAWER_STATE_KEY, "42");
    expect(readDrawerState()).toEqual({
      open: true,
      height: DRAWER_DEFAULT_HEIGHT,
      activeTab: DEFAULT_DRAWER_TAB,
    });
  });
});

describe("readDrawerState activeTab", () => {
  it("restores a stored tab", () => {
    localStorage.setItem(
      DRAWER_STATE_KEY,
      JSON.stringify({ open: true, height: 280, activeTab: "config" }),
    );
    expect(readDrawerState().activeTab).toBe("config");
  });

  it("falls back when the stored tab is not registered", () => {
    // A tab id outlives the tab: the key is written by whatever build last
    // ran, and a renamed or removed tab must not leave the pane resolving
    // to nothing.
    localStorage.setItem(
      DRAWER_STATE_KEY,
      JSON.stringify({ open: true, height: 280, activeTab: "gone" }),
    );
    expect(readDrawerState().activeTab).toBe(DEFAULT_DRAWER_TAB);
  });

  it("falls back for a non-string tab", () => {
    localStorage.setItem(
      DRAWER_STATE_KEY,
      JSON.stringify({ open: true, height: 280, activeTab: 3 }),
    );
    expect(readDrawerState().activeTab).toBe(DEFAULT_DRAWER_TAB);
  });

  it("falls back when the key is absent entirely", () => {
    expect(readDrawerState().activeTab).toBe(DEFAULT_DRAWER_TAB);
  });
});

describe("writeDrawerState", () => {
  it("round-trips through readDrawerState", () => {
    writeDrawerState({ open: false, height: 320, activeTab: "config" });
    expect(localStorage.getItem(DRAWER_STATE_KEY)).toBe(
      JSON.stringify({ open: false, height: 320, activeTab: "config" }),
    );
    expect(readDrawerState()).toEqual({
      open: false,
      height: 320,
      activeTab: "config",
    });
  });

  it("swallows a storage failure and leaves the read on defaults", () => {
    // Spied on the instance, not `Storage.prototype` — happy-dom's
    // `localStorage` carries its own `setItem`, so a prototype spy is never
    // reached and the test would pass without ever throwing.
    const setItem = vi
      .spyOn(localStorage, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });
    try {
      writeDrawerState({ open: false, height: 320, activeTab: "config" });
      expect(setItem).toHaveBeenCalledTimes(1);
      expect(readDrawerState()).toEqual({
        open: true,
        height: DRAWER_DEFAULT_HEIGHT,
        activeTab: DEFAULT_DRAWER_TAB,
      });
    } finally {
      setItem.mockRestore();
    }
  });

  it("does not use the control-state key", () => {
    // e2e specs seed `tpl-playground-config` before navigation; drawer chrome
    // sharing that key would let a seed clobber the user's drawer size.
    expect(DRAWER_STATE_KEY).toBe("tpl-playground-drawer");
    writeDrawerState({ open: true, height: 200, activeTab: "config" });
    expect(localStorage.getItem("tpl-playground-config")).toBeNull();
  });
});
