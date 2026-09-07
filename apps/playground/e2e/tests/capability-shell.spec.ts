import { expect, test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * The shell lives at its own route until step 6 flips the default, so these
 * tests navigate to it directly rather than through the chooser.
 *
 * Capability ids are written literally. Importing them from
 * `@/config/capabilities` would pull the barrel into Playwright's Node-side
 * transform, which cannot parse the editor's `.vue` source — guarded by
 * `tests/e2e-import-boundary.test.ts`.
 */
test.describe("capability shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
  });

  test("opens on the first capability and renders one editor", async ({
    page,
  }) => {
    await page.goto("/#capabilities");
    await expect(page.locator(SELECTORS.capabilityShell)).toBeVisible();
    await expect(page.locator(SELECTORS.capabilityEditor)).toHaveCount(1);
    await expect(
      page.locator(`${SELECTORS.capabilityRailItem}[aria-current="page"]`),
    ).toHaveText("Saved blocks");
  });

  test("a direct link opens that capability", async ({ page }) => {
    await page.goto("/#capabilities/comments");
    await expect(
      page.locator(`${SELECTORS.capabilityRailItem}[aria-current="page"]`),
    ).toHaveText("Comments");
    await expect(page.locator(SELECTORS.capabilityBlurb)).toContainText(
      "review",
    );
  });

  test("switching capability keeps the same editor element", async ({
    page,
  }) => {
    await page.goto("/#capabilities");
    const editor = page.locator(SELECTORS.capabilityEditor);
    await expect(editor).toHaveCount(1);
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="capability-editor"]');
      (el as HTMLElement).dataset.shellProbe = "same-node";
    });

    await page
      .locator(SELECTORS.capabilityRailItem, { hasText: "Comments" })
      .click();
    await expect(
      page.locator(`${SELECTORS.capabilityRailItem}[aria-current="page"]`),
    ).toHaveText("Comments");

    // The editor host is the same DOM node — the shell re-inits into it rather
    // than remounting the tree around it.
    await expect(editor).toHaveAttribute("data-shell-probe", "same-node");
  });

  test("the rail groups capabilities under a heading", async ({ page }) => {
    await page.goto("/#capabilities");
    // Two groups now carry a capability: "Backend & data" (six: saved
    // blocks, templates, version history, comments, test email, render) and
    // "Appearance" (shadow-dom, i18n) — "Authoring" and "Cloud" still have
    // nothing registered, so they stay omitted rather than rendering empty.
    await expect(page.locator(SELECTORS.capabilityRailGroup)).toHaveCount(2);
    await expect(page.locator(SELECTORS.capabilityRailGroup).first()).toContainText(
      "Backend & data",
    );
    await expect(page.locator(SELECTORS.capabilityRailGroup).last()).toContainText(
      "Appearance",
    );
    await expect(page.locator(SELECTORS.capabilityRailItem)).toHaveCount(8);
  });

  test("the default route is still the template chooser", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(SELECTORS.capabilityShell)).toHaveCount(0);
    await expect(page.locator(SELECTORS.templateCard).first()).toBeVisible();
  });

  test("renders the fixture's custom block instead of the unregistered-type placeholder", async ({
    page,
  }) => {
    // Every registered capability's fixture is "Product Launch", which embeds
    // a Testimonial custom block. Without `customBlocks` in the shell's
    // config, the block registry has no definition for it and the canvas
    // shows the dashed "Unknown block type" placeholder instead — a visible
    // defect on every capability page, not just this default one.
    await page.goto("/#capabilities");
    const editor = page.locator(SELECTORS.capabilityEditor);
    await expect(editor).toBeVisible();

    await expect(editor).toContainText("Maria Santos");
    await expect(editor).not.toContainText("Unknown block type");
  });
});
