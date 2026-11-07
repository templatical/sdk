import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { EditorPage } from "../pages/editor.page";
import { ScenePage } from "../pages/scene.page";

/**
 * Opening a 360px side panel shifts the properties panel left by 360px and
 * narrows the canvas by the same amount. The three move as one: the panel's
 * left edge stays on the properties panel's right edge in every frame, and the
 * canvas inset stays 320px (the properties panel) beyond it. Before the fix
 * the AI panel popped in place (its slide ran on a `display: contents` box)
 * and Comments jumped (a `transform` transition over Tailwind's `translate`).
 */

type Frame = {
  /** Panel's visible width, measured from the editor's right edge. */
  panel: number | null;
  /** Properties panel's distance from the editor's right edge. */
  properties: number;
  /** Canvas body's distance from the editor's right edge. */
  canvas: number;
};

async function sampleToggle(
  page: Page,
  trigger: string,
  panel: string,
): Promise<Frame[]> {
  return page
    .locator(SELECTORS.editorContainer)
    .locator(SELECTORS.canvasBody)
    .evaluate(
      async (body, { trigger, panel }) => {
        const root = body.closest(".tpl")!;
        const q = (selector: string) =>
          root.querySelector<HTMLElement>(selector);
        const edge = root.getBoundingClientRect().right;
        const frames: Frame[] = [];
        const start = performance.now();
        q(trigger)!.click();
        await new Promise<void>((resolve) => {
          const tick = () => {
            const box = q(panel)?.getBoundingClientRect();
            frames.push({
              panel: box ? Math.round(edge - box.left) : null,
              properties: Math.round(
                edge - q(".tpl-right-sidebar")!.getBoundingClientRect().right,
              ),
              canvas: Math.round(
                edge - q(".tpl-body")!.getBoundingClientRect().right,
              ),
            });
            if (performance.now() - start < 500) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        return frames;
      },
      { trigger, panel },
    );
}

function expectLockstep(frames: Frame[], opening: boolean) {
  for (const frame of frames) {
    expect(frame.canvas - frame.properties).toBeGreaterThanOrEqual(318);
    expect(frame.canvas - frame.properties).toBeLessThanOrEqual(322);
    if (frame.panel !== null)
      expect(Math.abs(frame.panel - frame.properties)).toBeLessThanOrEqual(2);
  }
  // A slide, not a pop: some frame shows the panel part of the way.
  expect(
    frames.some((frame) => frame.properties > 20 && frame.properties < 340),
  ).toBe(true);
  expect(frames.at(-1)).toEqual(
    opening
      ? { panel: 360, properties: 360, canvas: 680 }
      : { panel: null, properties: 0, canvas: 320 },
  );
}

for (const { scene, trigger, panel } of [
  {
    scene: "ai",
    trigger: '[data-testid="ai-menu-trigger"]',
    panel: ".tpl-ai-sidebar",
  },
  {
    scene: "comments",
    trigger: '[data-testid="comments-trigger"]',
    panel: ".tpl-comments-sidebar",
  },
]) {
  test(`the ${scene} panel, the properties panel and the canvas move as one`, async ({
    page,
    shadowDom,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const editor = new EditorPage(page);
    await new ScenePage(page, { shadowDom }).goto(scene);
    await editor.waitForReady();
    await editor.dismissOverlays();
    const root = page.locator(SELECTORS.editorContainer);
    // The panel is a lazy chunk: load it once, so the measured open is the
    // motion and not the fetch.
    await root.locator(trigger).click();
    await expect(root.locator(panel)).toBeVisible();
    await root.locator(trigger).click();
    await expect(root.locator(panel)).toHaveCount(0);

    expectLockstep(await sampleToggle(page, trigger, panel), true);
    expectLockstep(await sampleToggle(page, trigger, panel), false);
  });
}
