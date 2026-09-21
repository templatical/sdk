/**
 * Shadow DOM mount mode. Resolution order on first load:
 *   1. URL param `?shadowDom=0/1/false/true` — strongest (e2e fixture relies
 *      on this for deterministic project pinning).
 *   2. localStorage `tpl-playground-shadow-mode` — persists user's toggle.
 *   3. SDK default — `'shadow'`.
 */
export const SHADOW_STORAGE_KEY = "tpl-playground-shadow-mode";

export function readShadowDomFlag(): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get("shadowDom");
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
}

export function readStoredShadowMode(): "shadow" | "light" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(SHADOW_STORAGE_KEY);
  return v === "shadow" || v === "light" ? v : null;
}

export function resolveInitialShadowMode(): "shadow" | "light" {
  const urlFlag = readShadowDomFlag();
  if (urlFlag !== undefined) return urlFlag ? "shadow" : "light";
  return readStoredShadowMode() ?? "shadow";
}
