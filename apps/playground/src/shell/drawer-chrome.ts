/**
 * The capability drawer's persisted chrome — where it is stored, what a
 * height is allowed to be, and how it is read back.
 *
 * `CapabilityShell.vue` owns the state and restores it on load;
 * `CapabilityDrawer.vue` clamps a live drag against the same bounds. They
 * have to be the same bounds: a stored height the drag can never produce is
 * applied verbatim otherwise, and the drawer is `shrink-0`, so an
 * out-of-range value collapses `<main>` and takes the editor with it.
 */

/**
 * The drawer's own localStorage key — deliberately not `tpl-playground-config`,
 * which holds capability control state and is seeded by e2e specs before
 * navigation. Mixing UI chrome into it would let a spec's seed clobber the
 * user's drawer size.
 */
export const DRAWER_STATE_KEY = "tpl-playground-drawer";

/**
 * Clamp bounds for `height`, in pixels. `min` fits a couple of control rows
 * (label + help line) before the pane needs to scroll, so collapsing isn't
 * the only way to see more than one row. `max` leaves the editor above it a
 * usable slice of a typical viewport (e.g. ~200px at a 720px-tall window)
 * rather than letting the drawer squeeze it away entirely.
 */
export const DRAWER_MIN_HEIGHT = 160;
export const DRAWER_MAX_HEIGHT = 480;

/** Height a drawer opens at before anyone has resized it. */
export const DRAWER_DEFAULT_HEIGHT = 280;

export interface DrawerChromeState {
  open: boolean;
  height: number;
}

/** Hold `px` inside {@link DRAWER_MIN_HEIGHT}..{@link DRAWER_MAX_HEIGHT}. */
export function clampDrawerHeight(px: number): number {
  return Math.min(DRAWER_MAX_HEIGHT, Math.max(DRAWER_MIN_HEIGHT, px));
}

/**
 * The stored chrome, or defaults.
 *
 * Height is clamped rather than trusted: what reaches here is JSON somebody
 * else may have written — a hand-edited key, a build whose bounds differed —
 * and `NaN` is a `number` too, so finiteness is checked before clamping.
 */
export function readDrawerState(): DrawerChromeState {
  const defaults: DrawerChromeState = {
    open: true,
    height: DRAWER_DEFAULT_HEIGHT,
  };
  try {
    const raw = localStorage.getItem(DRAWER_STATE_KEY);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    const { open, height } = parsed as Partial<DrawerChromeState>;
    return {
      open: typeof open === "boolean" ? open : defaults.open,
      height: Number.isFinite(height)
        ? clampDrawerHeight(height as number)
        : defaults.height,
    };
  } catch {
    return defaults;
  }
}

/** Persist the drawer's chrome, replacing whatever was stored. */
export function writeDrawerState(next: DrawerChromeState): void {
  try {
    localStorage.setItem(DRAWER_STATE_KEY, JSON.stringify(next));
  } catch {
    // A private-mode or quota failure loses the setting for the next reload
    // only — the drawer keeps working from in-memory state this session.
  }
}
