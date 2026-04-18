import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

// Onboarding tests need clean localStorage state. They also share a dev
// server and are sensitive to timing of the feature-overlay → spotlight
// transition, so run them in a single worker to avoid cross-test contention.
test.describe.configure({ mode: "serial" });

test.describe("Onboarding tour", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("tpl-playground-onboarding-dismissed");
      localStorage.removeItem("tpl-playground-features-dismissed");
    });
  });

  test("onboarding starts on first editor load", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();

    // Dismiss feature overlay first if present
    const overlay = page.locator(SELECTORS.featureOverlay);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator(SELECTORS.featureOverlay + " button").last().click();
      await overlay.waitFor({ state: "hidden", timeout: 2000 });
    }

    // Onboarding should start
    await expect(page.locator(SELECTORS.onboardingSpotlight)).toBeVisible({
      timeout: 5000,
    });
  });

  test("first step tooltip visible", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();

    const overlay = page.locator(SELECTORS.featureOverlay);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator(SELECTORS.featureOverlay + " button").last().click();
      await overlay.waitFor({ state: "hidden", timeout: 2000 });
    }

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    const text = await tooltip.textContent();
    expect(text!.length).toBeGreaterThan(10);
  });

  test("progress shows step counter", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();

    const overlay = page.locator(SELECTORS.featureOverlay);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator(SELECTORS.featureOverlay + " button").last().click();
      await overlay.waitFor({ state: "hidden", timeout: 2000 });
    }

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    // Should show step progress like "1 of 8" or "1/8"
    const text = await tooltip.textContent();
    expect(text).toMatch(/1\s*(of|\/)\s*\d+/);
  });

  test("next button advances step", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();

    const overlay = page.locator(SELECTORS.featureOverlay);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator(SELECTORS.featureOverlay + " button").last().click();
      await overlay.waitFor({ state: "hidden", timeout: 2000 });
    }

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    const textBefore = await tooltip.textContent();

    // Click next button
    const nextBtn = tooltip.getByRole("button", { name: /next/i });
    await nextBtn.click();
    // Wait for transition
    await page.waitForTimeout(500);

    const textAfter = await tooltip.textContent();
    expect(textAfter).not.toBe(textBefore);
  });

  test("skip button dismisses tour", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();

    const overlay = page.locator(SELECTORS.featureOverlay);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator(SELECTORS.featureOverlay + " button").last().click();
      await overlay.waitFor({ state: "hidden", timeout: 2000 });
    }

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const skipBtn = tooltip.getByRole("button", { name: /skip/i });
    await skipBtn.click();

    await expect(page.locator(SELECTORS.onboardingSpotlight)).toHaveCount(0);
    await expect(tooltip).toHaveCount(0);
  });

  test("tour sets localStorage on dismiss", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();

    const overlay = page.locator(SELECTORS.featureOverlay);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator(SELECTORS.featureOverlay + " button").last().click();
      await overlay.waitFor({ state: "hidden", timeout: 2000 });
    }

    const tooltip = page.locator(SELECTORS.onboardingTooltip);
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const skipBtn = tooltip.getByRole("button", { name: /skip/i });
    await skipBtn.click();

    const dismissed = await page.evaluate(() =>
      localStorage.getItem("tpl-playground-onboarding-dismissed"),
    );
    expect(dismissed).toBeTruthy();
  });

  test("tour doesn't restart after dismiss", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    // Set dismissed state
    await page.evaluate(() =>
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true"),
    );
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Onboarding should NOT appear
    const spotlight = page.locator(SELECTORS.onboardingSpotlight);
    const visible = await spotlight.isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test("tour restart button works", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    // Set dismissed state so tour doesn't auto-start
    await page.evaluate(() =>
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true"),
    );
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Click tour restart button
    await page.locator(SELECTORS.tourButton).click();

    await expect(page.locator(SELECTORS.onboardingSpotlight)).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator(SELECTORS.onboardingTooltip)).toBeVisible();
  });
});
