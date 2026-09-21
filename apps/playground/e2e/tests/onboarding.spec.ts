import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Onboarding tour", () => {
  test("does not render on Launchpad launch", async ({ editorReady, page }) => {
    void editorReady;
    await expect(page.locator(SELECTORS.onboardingSpotlight)).toHaveCount(0);
    await expect(page.locator(SELECTORS.onboardingTooltip)).toHaveCount(0);
    await expect(page.locator(SELECTORS.featureOverlay)).toHaveCount(0);
    await expect(page.locator(SELECTORS.tourButton)).toHaveCount(0);
  });
});
