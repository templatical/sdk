import { expect, test } from "../fixtures/editor.fixture";
import { controlByPath, SELECTORS } from "../helpers/selectors";
import { seedControlState } from "../helpers/control-state";

/**
 * The drawer chrome hosted inside the capability shell at `#capabilities`:
 * a tab bar, a collapse toggle, and one pane — plus the Controls tab's own
 * rows, one per control, that the Controls-tab tests below drive.
 *
 * Capability and control identifiers are written literally, never imported
 * from `@/config/capabilities` — that barrel reaches `@templatical/editor`'s
 * `.vue` source, which Playwright's Node-side transform cannot parse, and
 * the whole spec file would fail to load. Guarded by
 * `tests/e2e-import-boundary.test.ts`.
 */
test.describe("capability drawer", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
  });

  test("opens by default with the Controls tab active", async ({ page }) => {
    await page.goto("/#capabilities");
    await expect(page.locator(SELECTORS.capabilityDrawer)).toBeVisible();
    await expect(page.locator(SELECTORS.capabilityDrawerPane)).toBeVisible();

    const controlsTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Controls",
    });
    await expect(controlsTab).toHaveAttribute("aria-selected", "true");
  });

  test("collapses and restores, keeping the tab bar visible throughout", async ({
    page,
  }) => {
    await page.goto("/#capabilities");
    const pane = page.locator(SELECTORS.capabilityDrawerPane);
    const toggle = page.locator(SELECTORS.capabilityDrawerToggle);
    const tabs = page.locator(SELECTORS.capabilityDrawerTab);

    await expect(pane).toBeVisible();
    await toggle.click();
    await expect(pane).toBeHidden();
    await expect(tabs.first()).toBeVisible();

    // The drawer is always re-openable from the same toggle.
    await toggle.click();
    await expect(pane).toBeVisible();
    await expect(tabs.first()).toBeVisible();
  });

  test("switching tabs swaps the pane", async ({ page }) => {
    await page.goto("/#capabilities");
    const controlsTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Controls",
    });
    const configTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Config",
    });

    await expect(controlsTab).toHaveAttribute("aria-selected", "true");
    await expect(configTab).toHaveAttribute("aria-selected", "false");

    await configTab.click();
    await expect(configTab).toHaveAttribute("aria-selected", "true");
    await expect(controlsTab).toHaveAttribute("aria-selected", "false");
  });

  test("the editor is still there with the drawer open", async ({ page }) => {
    await page.goto("/#capabilities");
    const editor = page.locator(SELECTORS.capabilityEditor);
    await expect(editor).toHaveCount(1);
    await expect(editor).toBeVisible();
    await expect(page.locator(SELECTORS.capabilityDrawer)).toBeVisible();
  });

  test("toggling savedBlocks.create off removes the bookmark action from the canvas", async ({
    page,
    editorPage,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    await editorPage.selectBlock(0);
    await expect(page.locator(SELECTORS.savedBlocksSaveAction)).toHaveCount(1);

    const createControl = page.locator(controlByPath("savedBlocks.create"));
    await createControl.locator(SELECTORS.capabilityControlInput).uncheck();

    // The shell re-inits the editor into the same host on a control change,
    // so the earlier selection is gone — reselecting proves the bookmark's
    // absence is the toggle's doing, not a stale selection.
    await editorPage.selectBlock(0);
    await expect(page.locator(SELECTORS.savedBlocksSaveAction)).toHaveCount(0);
  });

  test("a forced control is disabled and says why", async ({ page }) => {
    // templates.save belongs to a different capability, so seeding it is
    // what reaches it here — the rail would otherwise have to move.
    await seedControlState(page, { "templates.save": false });
    await page.goto("/#capabilities/version-history");

    const restoreControl = page.locator(controlByPath("versionHistory.restore"));
    await expect(
      restoreControl.locator(SELECTORS.capabilityControlInput),
    ).toBeDisabled();
    await expect(
      restoreControl.locator(SELECTORS.capabilityControlReason),
    ).toContainText("templates.save");
  });
});
