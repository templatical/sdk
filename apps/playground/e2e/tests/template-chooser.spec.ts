import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Template chooser", () => {
  test("shows 7 template cards plus blank", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const templateCards = page.locator(SELECTORS.templateCard);
    expect(await templateCards.count()).toBe(7);

    const blankCard = page.locator(SELECTORS.blankTemplateCard);
    await expect(blankCard).toBeVisible();
  });

  test("each template card shows name and description", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const cards = page.locator(SELECTORS.templateCard);
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // Each card should have at least two spans (name + description)
      const spans = card.locator("span");
      expect(await spans.count()).toBeGreaterThanOrEqual(2);

      // Name should be non-empty
      const name = await spans.first().textContent();
      expect(name!.trim().length).toBeGreaterThan(0);

      // Description should be non-empty
      const desc = await spans.nth(1).textContent();
      expect(desc!.trim().length).toBeGreaterThan(0);
    }
  });

  test("each template card has accessible label", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const cards = page.locator(SELECTORS.templateCard);
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const label = await cards.nth(i).getAttribute("aria-label");
      expect(label).toBeTruthy();
      expect(label!.length).toBeGreaterThan(5);
    }
  });

  test("blank template card has accessible label", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const blank = page.locator(SELECTORS.blankTemplateCard);
    const label = await blank.getAttribute("aria-label");
    expect(label).toBeTruthy();
  });

  test("selecting a template opens editor with blocks", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    // Use addInitScript since this test creates its own navigation
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });

    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    const count = await editorPage.getBlockCount();
    expect(count).toBeGreaterThan(0);
  });

  test("selecting blank template opens editor with empty canvas", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });

    await chooserPage.goto();
    await chooserPage.selectBlankTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await expect(page.locator(SELECTORS.canvasEmpty)).toBeVisible();
  });

  test("template cards have visual previews", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const cards = page.locator(SELECTORS.templateCard);
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      // Each card has a preview area (140px height div with wireframe)
      const previewArea = cards.nth(i).locator("div").first();
      const box = await previewArea.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThan(50);
    }
  });
});
