import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Editor canvas", () => {
  test("blank template shows empty state", async ({
    blankEditorReady,
    page,
  }) => {
    await expect(page.locator(SELECTORS.canvasEmpty)).toBeVisible();
  });

  test("empty state has icon and message", async ({
    blankEditorReady,
    page,
  }) => {
    await expect(page.locator(SELECTORS.canvasEmptyIcon)).toBeVisible();
    await expect(page.locator(SELECTORS.canvasEmptyTitle)).toBeVisible();
  });

  test("non-blank template has blocks", async ({
    editorReady: { editorPage },
  }) => {
    const count = await editorPage.getBlockCount();
    expect(count).toBeGreaterThan(0);
  });

  test("viewport toggle shows 2 options", async ({ editorReady, page }) => {
    const group = page.locator(SELECTORS.viewportGroup);
    await expect(group).toBeVisible();
    const radios = page.locator('[role="radio"]');
    expect(await radios.count()).toBe(2);
  });

  test("desktop viewport is default", async ({ editorReady, page }) => {
    await expect(page.locator(SELECTORS.viewportDesktop)).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("mobile viewport narrows canvas", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const desktopWidth = await editorPage.getCanvasWrapperWidth();
    await editorPage.switchViewport("Mobile");
    const mobileWidth = await editorPage.getCanvasWrapperWidth();
    expect(mobileWidth).toBeLessThan(desktopWidth);
    expect(mobileWidth).toBeLessThanOrEqual(400);
  });

  test("desktop viewport restores width", async ({
    editorReady: { editorPage },
  }) => {
    const originalWidth = await editorPage.getCanvasWrapperWidth();
    await editorPage.switchViewport("Mobile");
    await editorPage.switchViewport("Desktop");
    const restoredWidth = await editorPage.getCanvasWrapperWidth();
    expect(restoredWidth).toBe(originalWidth);
  });

  test("dark mode toggle works", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const toggle = page.locator(SELECTORS.darkModeToggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await editorPage.toggleDarkMode();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("preview mode toggle works", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const toggle = page.locator(SELECTORS.previewToggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await editorPage.togglePreview();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Editor canvas in a narrow pane", () => {
  // At this width the canvas pane is narrower than the email, so the stage
  // overflows it: both of its edges must still be reachable by scrolling.
  test.use({ viewport: { width: 1024, height: 768 } });

  test("an email wider than its pane scrolls to both edges", async ({
    editorReady,
    page,
  }) => {
    void editorReady;
    const pane = page.locator(".tpl-body");
    const email = page.locator(SELECTORS.canvasWrapper);
    // The email keeps its real width: the pane scrolls instead of the email
    // reflowing narrower than it will be sent.
    expect((await email.boundingBox())!.width).toBe(600);
    const overflow = await pane.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow).toBeGreaterThan(0);

    const paneBox = (await pane.boundingBox())!;
    await pane.evaluate((el) => {
      el.scrollLeft = 0;
    });
    const atStart = (await email.boundingBox())!;
    expect(atStart.x).toBeGreaterThanOrEqual(paneBox.x - 0.5);

    await pane.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const atEnd = (await email.boundingBox())!;
    expect(atEnd.x + atEnd.width).toBeLessThanOrEqual(
      paneBox.x + paneBox.width + 0.5,
    );
  });

  test("an email narrower than its pane stays centred", async ({
    editorReady,
    page,
  }) => {
    void editorReady;
    await page.setViewportSize({ width: 1600, height: 900 });
    const pane = page.locator(".tpl-body");
    const stage = page.locator(".tpl-canvas-stage");
    await expect
      .poll(async () => {
        const paneBox = (await pane.boundingBox())!;
        const stageBox = (await stage.boundingBox())!;
        const paneMiddle = paneBox.x + paneBox.width / 2;
        return Math.abs(stageBox.x + stageBox.width / 2 - paneMiddle);
      })
      .toBeLessThan(1);
  });
});

test.describe("Editor canvas empty state in dark UI", () => {
  test("stays light, like the email page it sits on", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    const empty = page.locator(SELECTORS.canvasEmpty);
    const background = () =>
      empty.evaluate((el) => getComputedStyle(el).backgroundColor);

    await scenePage.goto("minimum");
    await editorPage.waitForReady();
    const light = await background();

    await page.evaluate(() => {
      // Raw string: the playground's theme ref uses the string serializer.
      localStorage.setItem("tpl-playground-theme", "dark");
    });
    await page.reload();
    await editorPage.waitForReady();
    // The editor really is dark, or this test proves nothing.
    await expect(page.locator(".tpl[data-tpl-theme]").first()).toHaveAttribute(
      "data-tpl-theme",
      "dark",
    );
    expect(await background()).toBe(light);
  });
});
