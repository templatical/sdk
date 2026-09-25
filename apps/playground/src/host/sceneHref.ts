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

/**
 * A plain left click. Anything else (a modifier, the middle button) keeps the
 * browser's own link behaviour: new tab, new window, download.
 */
export function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * View-transition name the scene host's editor stage carries during a morph.
 * A catalog element given the same name for one navigation grows into it.
 */
export const SCENE_STAGE_TRANSITION = "pg-scene-stage";

/**
 * Class on <html> that switches the stage's name on (see style.css). The
 * name makes the stage a stacking context, so it may exist only while the
 * transition runs, never while a dialog can be open.
 */
export const MORPHING_CLASS = "pg-morphing";

interface ViewTransitionLike {
  ready: Promise<unknown>;
  finished: Promise<unknown>;
}

export interface NavigateOptions {
  /** Element that should morph into the editor stage, e.g. an email proof. */
  morphFrom?: HTMLElement | null;
}

export function navigatePlayground(
  url: string,
  options: NavigateOptions = {},
): void {
  const go = (): void => {
    history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => ViewTransitionLike;
  };
  if (prefersReducedMotion() || typeof doc.startViewTransition !== "function") {
    go();
    return;
  }
  const morphFrom = options.morphFrom ?? null;
  const root = document.documentElement;
  if (morphFrom) {
    morphFrom.style.viewTransitionName = SCENE_STAGE_TRANSITION;
    root.classList.add(MORPHING_CLASS);
  }
  const transition = doc.startViewTransition(go);
  // A skipped transition (hidden tab, name clash) rejects `ready`. The update
  // callback runs either way, so the navigation itself is never lost; an
  // unobserved promise here only surfaces as an unhandled rejection.
  transition.ready.catch(() => {});
  transition.finished
    .catch(() => {})
    .then(() => {
      if (!morphFrom) return;
      morphFrom.style.viewTransitionName = "";
      root.classList.remove(MORPHING_CLASS);
    });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
