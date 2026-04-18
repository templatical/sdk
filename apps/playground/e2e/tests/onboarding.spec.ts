import { test, expect } from "@playwright/test";
import { ChooserPage } from "../pages/chooser.page";
import { EditorPage } from "../pages/editor.page";
import { SELECTORS } from "../helpers/selectors";

// Onboarding tests need clean localStorage state. They also share a dev
// server and are sensitive to timing of the feature-overlay → spotlight
// transition, so run them in a single worker to avoid cross-test contention.
test.describe.configure({ mode: "serial" });

test.describe("Onboarding tour", () => {
  /**
   * Fresh onboarding state: localStorage is cleared BEFORE the page boots,
   * so App.vue sees a virgin user and triggers the tour.
   */
  async function startWithFreshOnboarding(
    chooserPage: ChooserPage,
    editorPage: EditorPage,
    page: import("@playwright/test").Page,
    { preDismiss = false }: { preDismiss?: boolean } = {},
  ) {
    await page.addInitScript((dismiss: boolean) => {
      localStorage.removeItem("tpl-playground-onboarding-dismissed");
      localStorage.removeItem("tpl-playground-features-dismissed");
      if (dismiss) {
        localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
        localStorage.setItem("tpl-playground-features-dismissed", "true");
      }
    }, preDismiss);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
  }

  /** Close the feature-showcase modal that appears before the tour. */
  async function closeFeatureOverlay(page: import("@playwright/test").Page) {
    const close = page.locator(SELECTORS.featureOverlayClose);
    if (await close.isVisible()) {
      await close.click();
      await page.locator(SELECTORS.featureOverlay).waitFor({ state: "hidden" });
    }
  }

  test("onboarding starts on first editor load", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page);
    await closeFeatureOverlay(page);

    await expect(page.locator(SELECTORS.onboardingSpotlight)).toBeVisible();
  });

  test("first step tooltip visible", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page);
    await closeFeatureOverlay(page);

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible();
    const text = await tooltip.textContent();
    expect(text?.trim().length ?? 0).toBeGreaterThan(10);
  });

  test("progress shows step counter", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page);
    await closeFeatureOverlay(page);

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/1\s*(of|\/)\s*\d+/);
  });

  test("next button advances step", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page);
    await closeFeatureOverlay(page);

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible();
    // Tooltip text typewrites in; wait until the full first-step string lands.
    await expect(tooltip).toContainText(/1\s*(of|\/)\s*\d+/);

    await page.locator(SELECTORS.onboardingNext).click();
    await expect(tooltip).toContainText(/2\s*(of|\/)\s*\d+/);
  });

  test("skip button dismisses tour", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page);
    await closeFeatureOverlay(page);

    await expect(page.locator(SELECTORS.onboardingTooltip)).toBeVisible();
    await page.locator(SELECTORS.onboardingSkip).click();

    await expect(page.locator(SELECTORS.onboardingSpotlight)).toHaveCount(0);
    await expect(page.locator(SELECTORS.onboardingTooltip)).toHaveCount(0);
  });

  test("tour sets localStorage on dismiss", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page);
    await closeFeatureOverlay(page);

    await expect(page.locator(SELECTORS.onboardingTooltip)).toBeVisible();
    await page.locator(SELECTORS.onboardingSkip).click();
    await expect(page.locator(SELECTORS.onboardingSpotlight)).toHaveCount(0);

    const dismissed = await page.evaluate(() =>
      localStorage.getItem("tpl-playground-onboarding-dismissed"),
    );
    expect(dismissed).toBe("true");
  });

  test("tour doesn't restart after dismiss", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page, {
      preDismiss: true,
    });
    await editorPage.dismissOverlays();

    // Tour must not appear. Assert stays hidden after a short settle window.
    await expect(page.locator(SELECTORS.onboardingSpotlight)).toBeHidden();
  });

  test("tour restart button works", async ({ page }) => {
    const chooserPage = new ChooserPage(page);
    const editorPage = new EditorPage(page);
    await startWithFreshOnboarding(chooserPage, editorPage, page, {
      preDismiss: true,
    });
    await editorPage.dismissOverlays();

    await page.locator(SELECTORS.tourButton).click();
    await expect(page.locator(SELECTORS.onboardingSpotlight)).toBeVisible();
    await expect(page.locator(SELECTORS.onboardingTooltip)).toBeVisible();
  });
});
