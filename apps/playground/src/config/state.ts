import type { ControlState } from "./types";

/**
 * The localStorage key holding capability control state: a flat map from a
 * control's `path` (e.g. `"savedBlocks.update"`) to the value it's set to.
 * Read by `readControlState()` below and resolved into editor config by
 * `buildCapabilityConfig()`.
 *
 * e2e seeds this before navigation via `page.addInitScript` — setting it
 * after `goto()` races the app's own mount-time read.
 */
export const CONTROL_STATE_KEY = "tpl-playground-config";

export function readControlState(): ControlState {
  try {
    const raw = localStorage.getItem(CONTROL_STATE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ControlState) : {};
  } catch {
    return {};
  }
}

/** Persist control state, replacing whatever was stored. */
export function writeControlState(state: ControlState): void {
  try {
    localStorage.setItem(CONTROL_STATE_KEY, JSON.stringify(state));
  } catch {
    // A private-mode or quota failure loses the setting, not the session:
    // the drawer keeps its in-memory value and the editor still re-inits.
  }
}

/** Merge one control path into the stored state and return the result. */
export function setControlValue(path: string, value: unknown): ControlState {
  const next = { ...readControlState(), [path]: value };
  writeControlState(next);
  return next;
}
