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
});
