/**
 * Shadow DOM mount mode for host pages: the `?shadowDom=0/1/false/true` URL
 * param (each e2e project pins its mode with it), else the SDK default,
 * shadow. Light DOM has its own scene (Shadow DOM off).
 *
 * Deliberately not persisted. A stored preference with no control left to
 * change it would strand a visitor in light DOM on every scene.
 */
export function readShadowDomFlag(): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get("shadowDom");
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
}

export function resolveShadowDom(): boolean {
  return readShadowDomFlag() ?? true;
}
