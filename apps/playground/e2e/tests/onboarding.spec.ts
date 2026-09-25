import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Onboarding tour", () => {
  test("does not render when dismissed", async ({ editorReady, page }) => {
    void editorReady;
    await expect(page.locator(SELECTORS.hostTour)).toHaveCount(0);
    await expect(page.locator(SELECTORS.onboardingSpotlight)).toHaveCount(0);
    await expect(page.locator(SELECTORS.featureOverlay)).toHaveCount(0);
  });

  test("first scene open walks frame, Code, Docs", async ({
    page,
    shadowDom,
  }) => {
    await page.goto(`/scenes/minimum?shadowDom=${shadowDom ? "1" : "0"}`);
    const tour = page.locator(SELECTORS.hostTour);
    await expect(tour).toBeVisible();
    await expect(tour).toContainText("The editor");
    await page.locator(SELECTORS.onboardingNext).click();
    await expect(tour).toContainText("Code");
    await page.locator(SELECTORS.onboardingNext).click();
    await expect(tour).toContainText("Docs");
    await page.locator(SELECTORS.onboardingNext).click();
    await expect(tour).toHaveCount(0);
  });

  test.describe("keyboard and screen reader", () => {
    test.beforeEach(async ({ page, shadowDom }) => {
      await page.goto(`/scenes/minimum?shadowDom=${shadowDom ? "1" : "0"}`);
      await expect(page.locator(SELECTORS.hostTour)).toBeVisible();
    });

    test("focus moves into the tour, onto Next", async ({ page }) => {
      await expect(page.locator(SELECTORS.onboardingNext)).toBeFocused();
    });

    test("Tab stays inside the tour", async ({ page }) => {
      const tour = page.locator(SELECTORS.hostTour);
      for (let press = 0; press < 4; press += 1) {
        await page.keyboard.press("Tab");
        expect(
          await tour.evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true);
      }
    });

    test("Escape dismisses the tour and remembers it", async ({ page }) => {
      await page.keyboard.press("Escape");
      await expect(page.locator(SELECTORS.hostTour)).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          localStorage.getItem("tpl-playground-host-tour-dismissed"),
        ),
      ).toBe("true");
    });

    test("the dialog is named and described by its copy", async ({ page }) => {
      const tour = page.locator(SELECTORS.hostTour);
      await expect(tour).toHaveAccessibleName("The editor");
      await expect(tour).toHaveAccessibleDescription(
        "This frame is the editor you embed in your app. Everything in it is live.",
      );
    });

    test("the first step leaves the block palette visible", async ({
      page,
    }) => {
      const tooltip = await page.locator(SELECTORS.hostTour).boundingBox();
      const palette = await page
        .locator('button[aria-label="Insert Section block"]')
        .boundingBox();
      expect(tooltip).not.toBeNull();
      expect(palette).not.toBeNull();
      const overlaps =
        tooltip!.x < palette!.x + palette!.width &&
        palette!.x < tooltip!.x + tooltip!.width &&
        tooltip!.y < palette!.y + palette!.height &&
        palette!.y < tooltip!.y + tooltip!.height;
      expect(overlaps).toBe(false);
    });
  });
});
