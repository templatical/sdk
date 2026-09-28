import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { EditorPage } from "../pages/editor.page";
import type { ScenePage } from "../pages/scene.page";

/**
 * Small-screen gate (#235). The editor is desktop-class — below ~768px it
 * replaces its three-pane chrome (palette rail + canvas + 320px properties
 * panel) with a "use a larger screen" notice instead of a crushed, unusable
 * layout.
 *
 * This is the real-browser complement to the unit test, which mocks
 * `matchMedia` and so can't prove the gate against an actual viewport. Here we
 * drive a real narrow viewport and a real resize, exercising the live media
 * query, the shadow-DOM-adopted overlay, and the reactive teardown end to end.
 * Runs in both the light- and shadow-DOM projects.
 *
 * Below this width the playground shows its setup card instead of mounting
 * the editor, so the scene opens with `?phoneCard=0` to reach the SDK's own
 * notice.
 */
test.describe("Small-screen notice (#235)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  async function openNarrowEditor(
    scenePage: ScenePage,
    editorPage: EditorPage,
  ): Promise<void> {
    await scenePage.goto("example-launchpad-launch", { phoneCard: "0" });
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
  }

  test("replaces the editor chrome with a full-cover notice below the breakpoint", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await openNarrowEditor(scenePage, editorPage);

    const notice = page.locator(SELECTORS.smallScreenNotice);
    await expect(notice).toBeVisible();

    // i18n resolves end-to-end (e2e default locale is en).
    await expect(notice.locator("h2")).toHaveText("Larger screen required");

    // It is a full-cover gate, not a stray element: its box matches the
    // editor container's, so the broken chrome behind it is fully hidden.
    const noticeBox = await notice.boundingBox();
    const containerBox = await page
      .locator(SELECTORS.editorContainer)
      .boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(containerBox).not.toBeNull();
    expect(Math.abs(noticeBox!.width - containerBox!.width)).toBeLessThan(4);
    expect(Math.abs(noticeBox!.height - containerBox!.height)).toBeLessThan(4);

    // Matching boxes isn't enough — the original #235 follow-up bug left the
    // overlay at z-auto, BEHIND the explicitly-z-indexed chrome, so the box
    // matched while the sidebar/header still showed through. Assert the notice
    // is genuinely the top layer: the element under the header strip (chrome,
    // z-50) must resolve into the notice. Pierces shadow roots so it holds in
    // both the light- and shadow-DOM projects.
    const headerPoint = {
      x: containerBox!.x + containerBox!.width / 2,
      y: containerBox!.y + 10,
    };
    const topmost = await page.evaluate(({ x, y }) => {
      let el: Element | null = document.elementFromPoint(x, y);
      while (el && el.shadowRoot) {
        const inner = el.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === el) break;
        el = inner;
      }
      return el && el.closest('[data-testid="small-screen-notice"]')
        ? "notice"
        : "chrome";
    }, headerPoint);
    expect(topmost).toBe("notice");
  });

  test("clears the notice and restores the chrome when the viewport grows past the breakpoint", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await openNarrowEditor(scenePage, editorPage);

    const notice = page.locator(SELECTORS.smallScreenNotice);
    await expect(notice).toBeVisible();

    // Grow past 768px — the reactive media query should drop the gate.
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(notice).toBeHidden();
    // Chrome is usable again: the palette rail renders.
    await expect(page.locator(SELECTORS.sidebarRail)).toBeVisible();
  });
});
