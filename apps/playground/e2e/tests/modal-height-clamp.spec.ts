import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";

/**
 * A dialog must stay inside the box its backdrop actually covers, so its
 * controls stay reachable however the host page is built.
 *
 * `TplModal`'s backdrop is `fixed; inset: 0`, which means the viewport only
 * while nothing traps it. An ancestor with `transform`, `filter`,
 * `backdrop-filter`, `perspective`, `will-change: transform`,
 * `contain: paint`, `container-type`, or a running transform animation becomes
 * the containing block for fixed descendants — and the editor is a component
 * embedded in someone else's page, so any of those can sit above it.
 *
 * When one does, `inset: 0` resolves to that ancestor's box while a `vh` cap on
 * the panel still resolves to the viewport. Issue #575: a 420px-tall host
 * inside a 720px viewport produced a 648px panel (90vh) inside a 420px
 * containing block, clipped ~113px off both the top and the bottom by the
 * host's `overflow: hidden`, with `overflow-y: visible` on the panel leaving no
 * way to scroll to the Send button. Every dialog was already capped and
 * internally scrollable — the cap was measuring the wrong box.
 *
 * `tests/overlay-height-scope.test.ts` in `@templatical/editor` enforces the
 * rule structurally. This spec is the behavioural proof: it arms a real trap
 * and asserts what the browser lays out. happy-dom reports 0 for every box, so
 * the clipping is not reachable from a unit test.
 */

/**
 * Height of the trapped host box. Well under the 720px viewport the projects
 * run at, so a viewport-relative cap overshoots it by a wide margin.
 */
const TRAPPED_HOST_HEIGHT = 420;

/**
 * Arm the trap on the editor's mount container: `transform` makes it the
 * containing block for the fixed backdrop, and it already carries
 * `overflow-hidden`, which is what turns the overflow into lost controls.
 *
 * Applied as a stylesheet rather than inline so it survives Vue re-renders of
 * the container, and keyed off `data-testid` rather than the container's
 * Tailwind classes.
 */
async function trapFixedPositioning(page: Page): Promise<void> {
  // `align-self` + `height` shortens the cross axis only. The container is a
  // `flex-1` item of a row flex parent, so setting `flex` here would collapse
  // its width instead.
  await page.addStyleTag({
    content: `
      [data-testid="editor-container"] {
        transform: translateZ(0);
        align-self: flex-start;
        height: ${TRAPPED_HOST_HEIGHT}px;
      }
    `,
  });
}

interface Clamp {
  /** The box the backdrop actually covers — the host's, once trapped. */
  containingBlock: { top: number; bottom: number; height: number };
  backdrop: { height: number };
  panel: { top: number; bottom: number; height: number };
  /** Positive when the panel escapes past the clipping edge. */
  clippedAbove: number;
  clippedBelow: number;
  /** Whether some descendant absorbs the shortfall by scrolling. */
  hasInternalScroll: boolean;
}

/**
 * Measure the panel against the box that clips it, from the editor's effective
 * root so one spec covers both the light-DOM and shadow-DOM projects.
 */
async function measureClamp(
  page: Page,
  panelSelector: string,
): Promise<Clamp | null> {
  return page.evaluate((sel) => {
    const host = Array.from(document.querySelectorAll("*")).find(
      (el) => (el as HTMLElement).shadowRoot,
    ) as HTMLElement | undefined;
    const root: Document | ShadowRoot = host?.shadowRoot ?? document;

    const panel = root.querySelector(sel) as HTMLElement | null;
    const container = document.querySelector(
      '[data-testid="editor-container"]',
    ) as HTMLElement | null;
    if (!panel || !container) return null;

    // The backdrop is the fixed ancestor; the wrapper sits between it and the
    // panel, so walk up rather than assuming a fixed depth.
    let backdrop: HTMLElement | null = panel.parentElement;
    while (backdrop && getComputedStyle(backdrop).position !== "fixed") {
      backdrop = backdrop.parentElement;
    }
    if (!backdrop) return null;

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    return {
      containingBlock: {
        top: containerRect.top,
        bottom: containerRect.bottom,
        height: containerRect.height,
      },
      backdrop: { height: backdrop.getBoundingClientRect().height },
      panel: {
        top: panelRect.top,
        bottom: panelRect.bottom,
        height: panelRect.height,
      },
      clippedAbove: containerRect.top - panelRect.top,
      clippedBelow: panelRect.bottom - containerRect.bottom,
      hasInternalScroll: Array.from(panel.querySelectorAll("*")).some(
        (el) =>
          getComputedStyle(el as HTMLElement).overflowY === "auto" &&
          (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight,
      ),
    };
  }, panelSelector);
}

test.describe("modal height clamp", () => {
  test("the test-email dialog stays inside a trapped host box", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await trapFixedPositioning(page);

    await page.locator(SELECTORS.testEmailTrigger).click();
    await expect(page.locator(SELECTORS.testEmailDialog)).toBeVisible();

    const clamp = await measureClamp(page, SELECTORS.testEmailDialog);
    expect(clamp).not.toBe(null);

    // The trap is armed: the backdrop covers the host box, not the viewport.
    // Without this the rest of the test would pass for the wrong reason.
    //
    // `inset: 0` resolves to the containing block's PADDING box, so the
    // backdrop comes in a little under the host's border-box height — the
    // playground's container carries a 1px border. The point of the assertion
    // is that it tracks the host rather than the viewport, so allow for that
    // few-px difference instead of pinning an exact number.
    expect(clamp!.containingBlock.height).toBeCloseTo(TRAPPED_HOST_HEIGHT, 0);
    expect(clamp!.backdrop.height).toBeLessThanOrEqual(TRAPPED_HOST_HEIGHT);
    expect(clamp!.backdrop.height).toBeGreaterThan(TRAPPED_HOST_HEIGHT - 8);
    expect(clamp!.backdrop.height).toBeLessThan(page.viewportSize()!.height);

    // Nothing escapes the clipping edges. Pre-fix this measured +112 below and
    // +112 above at the projects' 720px viewport.
    expect(clamp!.clippedAbove).toBeLessThanOrEqual(0);
    expect(clamp!.clippedBelow).toBeLessThanOrEqual(0);
    expect(clamp!.panel.height).toBeLessThanOrEqual(TRAPPED_HOST_HEIGHT);

    // Capped and still usable: the preview absorbs the shortfall by scrolling
    // rather than the panel silently swallowing its own controls.
    expect(clamp!.hasInternalScroll).toBe(true);
  });

  test("the send button stays reachable inside a trapped host box", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await trapFixedPositioning(page);

    await page.locator(SELECTORS.testEmailTrigger).click();
    await expect(page.locator(SELECTORS.testEmailDialog)).toBeVisible();

    // The reported symptom, stated as the control the user could not reach.
    //
    // Measured, not clicked: `click()` scrolls the clipping ancestor to bring
    // its target into view, which a person staring at a dialog with no
    // scrollbar cannot do — pre-fix this button sat 112px below the host's
    // bottom edge and Playwright still clicked it happily. Geometry is what
    // separates "reachable" from "reachable by a robot".
    const send = page.locator(SELECTORS.testEmailSend);
    await expect(send).toBeVisible();

    const reach = await page.evaluate((sel) => {
      const host = Array.from(document.querySelectorAll("*")).find(
        (el) => (el as HTMLElement).shadowRoot,
      ) as HTMLElement | undefined;
      const root: Document | ShadowRoot = host?.shadowRoot ?? document;
      const button = root.querySelector(sel) as HTMLElement | null;
      const container = document.querySelector(
        '[data-testid="editor-container"]',
      ) as HTMLElement | null;
      if (!button || !container) return null;
      const b = button.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      return { belowHost: b.bottom - c.bottom, aboveHost: c.top - b.top };
    }, SELECTORS.testEmailSend);

    expect(reach).not.toBe(null);
    expect(reach!.belowHost).toBeLessThanOrEqual(0);
    expect(reach!.aboveHost).toBeLessThanOrEqual(0);

    // And it still works once reached.
    await send.click();

    await expect(page.locator(SELECTORS.testEmailSuccess)).toBeVisible({
      timeout: 5000,
    });
  });

  test("the saved-blocks browser stays inside a trapped host box", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await trapFixedPositioning(page);

    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowser)).toBeVisible();

    const clamp = await measureClamp(page, SELECTORS.savedBlocksBrowser);
    expect(clamp).not.toBe(null);
    expect(clamp!.clippedAbove).toBeLessThanOrEqual(0);
    expect(clamp!.clippedBelow).toBeLessThanOrEqual(0);
    expect(clamp!.panel.height).toBeLessThanOrEqual(TRAPPED_HOST_HEIGHT);

    // The close button is the one control that must never be clipped — it is
    // the only way out of a dialog whose Escape handling a host could preempt.
    await page.locator(SELECTORS.savedBlocksBrowserClose).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowser)).toBeHidden();
  });

  test("clicking the gap below the panel still closes the dialog", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    // Regression cover for the wrapper the clamp introduced. It spans the
    // backdrop's full height, so it now intercepts clicks in the band above and
    // below the panel that used to reach the backdrop's own `@click.self`.
    // Without the handler repeated on the wrapper, click-outside-to-close dies
    // silently in exactly that band — and no other spec clicks a TplModal
    // backdrop, so nothing else would catch it.
    await page.locator(SELECTORS.testEmailTrigger).click();
    const dialog = page.locator(SELECTORS.testEmailDialog);
    await expect(dialog).toBeVisible();

    // Horizontally inside the panel's own column, so the point lands on the
    // wrapper rather than on the backdrop either side of it.
    const gap = await page.evaluate(() => {
      const host = Array.from(document.querySelectorAll("*")).find(
        (el) => (el as HTMLElement).shadowRoot,
      ) as HTMLElement | undefined;
      const root: Document | ShadowRoot = host?.shadowRoot ?? document;
      const panel = root.querySelector(
        '[role="dialog"][aria-labelledby="tpl-test-email-title"]',
      ) as HTMLElement | null;
      if (!panel) return null;
      let backdrop: HTMLElement | null = panel.parentElement;
      while (backdrop && getComputedStyle(backdrop).position !== "fixed") {
        backdrop = backdrop.parentElement;
      }
      if (!backdrop) return null;
      const p = panel.getBoundingClientRect();
      const b = backdrop.getBoundingClientRect();
      return {
        x: p.left + p.width / 2,
        y: (p.bottom + b.bottom) / 2,
        panelBottom: p.bottom,
      };
    });

    expect(gap).not.toBe(null);
    expect(gap!.y).toBeGreaterThan(gap!.panelBottom);

    await page.mouse.click(gap!.x, gap!.y);
    await expect(dialog).toBeHidden();
  });

  test("an untrapped host still gets a viewport-sized dialog", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    // The fix must not shrink the common case. With no trap the backdrop still
    // covers the viewport, so the dialog is bounded by the viewport as before
    // rather than by the editor's own (possibly small) box.
    await page.locator(SELECTORS.testEmailTrigger).click();
    await expect(page.locator(SELECTORS.testEmailDialog)).toBeVisible();

    const clamp = await measureClamp(page, SELECTORS.testEmailDialog);
    expect(clamp).not.toBe(null);

    const viewportHeight = page.viewportSize()!.height;
    expect(clamp!.backdrop.height).toBeCloseTo(viewportHeight, 0);
    expect(clamp!.panel.top).toBeGreaterThanOrEqual(0);
    expect(clamp!.panel.bottom).toBeLessThanOrEqual(viewportHeight);
  });
});
