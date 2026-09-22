import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Setup catalog", () => {
  test("shows the catalog with Minimum first", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await expect(page.locator(SELECTORS.catalogScreen)).toBeVisible();
    const hero = page.locator('[data-testid="scene-link-minimum"]');
    await expect(hero).toBeVisible();
    const firstLink = page.locator("[data-testid^='scene-link-']").first();
    await expect(firstLink).toHaveAttribute(
      "data-testid",
      "scene-link-minimum",
    );
  });

  test("Minimum hero opens the minimum scene host", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await page.locator('[data-testid="scene-link-minimum"]').click();
    await expect(page.locator(SELECTORS.sceneHost)).toBeVisible();
    await expect(page).toHaveURL(/\/scenes\/minimum/);
    await editorPage.waitForReady();
  });

  test("setup tabs switch the card grid", async ({ chooserPage, page }) => {
    await chooserPage.goto();
    await expect(page.locator('[data-testid="scene-link-theming"]')).toBeVisible();
    await expect(page.locator('[data-testid="scene-link-saved-blocks"]')).toHaveCount(0);
    await page.locator('[data-testid="catalog-tab-backend"]').click();
    await expect(page.locator('[data-testid="scene-link-saved-blocks"]')).toBeVisible();
    await expect(page.locator('[data-testid="scene-link-theming"]')).toHaveCount(0);
    await page.locator('[data-testid="catalog-tab-import"]').click();
    await expect(page.locator('[data-testid="scene-link-import-unlayer"]')).toBeVisible();
    await expect(page.locator('[data-testid="scene-link-saved-blocks"]')).toHaveCount(0);
  });

  test("setup nav looks selected and moves with arrows", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const configure = page.locator('[data-testid="catalog-tab-configure"]');
    const personalization = page.locator(
      '[data-testid="catalog-tab-personalization"]',
    );
    await expect(configure).toHaveAttribute("aria-selected", "true");
    await expect(configure).toHaveClass(/border-primary/);
    await configure.focus();
    await page.keyboard.press("ArrowDown");
    await expect(personalization).toHaveAttribute("aria-selected", "true");
    await expect(personalization).toBeFocused();
    await expect(page.locator('[data-testid="scene-link-merge-tags"]')).toBeVisible();
  });

  test("example card opens Launchpad launch", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    const card = page.locator(
      '[data-testid="scene-link-example-launchpad-launch"]',
    );
    await page.locator('[data-testid="catalog-tab-examples"]').click();
    await expect(card.locator('[data-testid="catalog-sketch"]')).toBeVisible();
    await card.click();
    await expect(page.locator(SELECTORS.sceneHost)).toBeVisible();
    await expect(page).toHaveURL(/\/scenes\/example-launchpad-launch/);
    await editorPage.waitForReady();
  });
});
