/** Scene URLs keep the host `?shadowDom=` pin and drop scene-specific variants. */
export function sceneHref(
  id: string,
  search: URLSearchParams | string = "",
): string {
  const src = typeof search === "string" ? new URLSearchParams(search) : search;
  const q = new URLSearchParams();
  const shadow = src.get("shadowDom");
  if (shadow !== null) q.set("shadowDom", shadow);
  const qs = q.toString();
  return qs ? `/scenes/${id}?${qs}` : `/scenes/${id}`;
}

export function navigatePlayground(url: string): void {
  const go = (): void => {
    history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => void;
  };
  if (
    !prefersReducedMotion() &&
    typeof doc.startViewTransition === "function"
  ) {
    doc.startViewTransition(go);
    return;
  }
  go();
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
