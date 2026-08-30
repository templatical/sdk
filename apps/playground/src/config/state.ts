import type { ControlState } from "./types";

/**
 * The single key replacing the fourteen `tpl-playground-*` flags.
 *
 * e2e seeds this before navigation (`page.addInitScript`), which is the same
 * timing the flags required — setting it after `goto()` races the app's
 * mount-time read.
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
