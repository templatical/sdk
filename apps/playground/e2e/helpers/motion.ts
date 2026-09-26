import type { Page } from "@playwright/test";

/**
 * Pauses every CSS transition and animation on the page (Chromium only; both
 * projects are Chromium) and returns a function that resumes them.
 *
 * A frozen page shows each transition's first frame, which is how a spec
 * proves a panel animates instead of popping: a panel that pops is already at
 * its end state. Only transitions declared on the element's own class stay
 * frozen. Vue ends a transition phase on a fallback timeout and drops its
 * -active classes, which cancels a transition declared there.
 */
export async function freezeMotion(page: Page): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
  return async () => {
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
    await cdp.detach();
  };
}

/** Distance an element's transform moves it vertically, in px. */
export function translateY(el: Element): number {
  return new DOMMatrix(getComputedStyle(el).transform).m42;
}
