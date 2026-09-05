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

    // Unchecked, not merely disabled: `build()` emits `restore: false`, and the
    // Config tab prints exactly that. A checked box beside a sentence saying
    // restore cannot run would make two panes of one drawer disagree.
    await expect(
      restoreControl.locator(SELECTORS.capabilityControlInput),
    ).not.toBeChecked();
  });

  test("a number control applies on change, reaching the provider it configures", async ({
    page,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    const source = page.locator(SELECTORS.capabilityConfigSource);
    const configTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Config",
    });

    // At zero the capability hands the provider's own `list` straight through,
    // so the delay wrapper's `setTimeout` is absent from the printed source.
    await configTab.click();
    await expect(source).toContainText("savedBlocks:");
    await expect(source).not.toContainText("setTimeout");

    await page
      .locator(SELECTORS.capabilityDrawerTab, { hasText: "Controls" })
      .click();
    await page
      .locator(controlByPath("savedBlocks.listDelayMs"))
      .locator(SELECTORS.capabilityControlInput)
      .fill("2000");

    // The wrapper appearing in the real config is the re-init's completion
    // signal, so opening the browser below cannot race the old instance.
    await configTab.click();
    await expect(source).toContainText("setTimeout");

    // The control's stated purpose: localStorage answers instantly, so a
    // latency stand-in is the only way the browser's first-open skeleton is
    // reachable at all.
    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksLoading)).toBeVisible();
  });

  test("a boolean control lands in the Config tab", async ({ page }) => {
    await page.goto("/#capabilities/templates");
    const source = page.locator(SELECTORS.capabilityConfigSource);
    const configTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Config",
    });

    await configTab.click();
    await expect(source).toContainText("autoSave: false");

    await page
      .locator(SELECTORS.capabilityDrawerTab, { hasText: "Controls" })
      .click();
    await page
      .locator(controlByPath("templates.autoSave"))
      .locator(SELECTORS.capabilityControlInput)
      .check();

    await configTab.click();
    await expect(source).toContainText("autoSave: true");
  });

  test("the Config tab renders the key the active capability owns", async ({
    page,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    await page
      .locator(SELECTORS.capabilityDrawerTab, { hasText: "Config" })
      .click();

    await expect(page.locator(SELECTORS.capabilityConfigSource)).toContainText(
      "savedBlocks:",
    );
  });

  test("toggling savedBlocks.create off lands as create: false in the Config tab", async ({
    page,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    const configTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Config",
    });
    const controlsTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Controls",
    });
    const source = page.locator(SELECTORS.capabilityConfigSource);

    // The positive assertion first: it waits for the pane to hold real
    // source, so the negative below cannot pass against an element that has
    // not rendered yet.
    await configTab.click();
    await expect(source).toContainText("savedBlocks:");
    await expect(source).not.toContainText("create: false");

    await controlsTab.click();
    await page
      .locator(controlByPath("savedBlocks.create"))
      .locator(SELECTORS.capabilityControlInput)
      .uncheck();

    await configTab.click();
    await expect(source).toContainText("create: false");
  });

  test("container is annotated rather than printed as an empty object", async ({
    page,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    await page
      .locator(SELECTORS.capabilityDrawerTab, { hasText: "Config" })
      .click();

    const source = page.locator(SELECTORS.capabilityConfigSource);
    await expect(source).toContainText("container: /*");
    await expect(source).not.toContainText("container: {}");
  });

  test("switching fixture reloads the editor with that template's content, keeps the capability, and lasts only for this visit", async ({
    page,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    const picker = page.locator(SELECTORS.capabilityFixturePicker);
    const canvas = page.locator(SELECTORS.canvasBody);
    const activeRailItem = page.locator(
      `${SELECTORS.capabilityRailItem}[aria-current="page"]`,
    );

    // Saved blocks curates Product Launch. Its own heading is the positive
    // control for every negative assertion below — a block count alone would
    // be satisfied by any template of the same length.
    await expect(picker).toHaveValue("product-launch");
    await expect(canvas).toContainText("Introducing Launchpad v2.0");

    await picker.selectOption("password-reset");

    // Positive first: it waits for the re-inited canvas to hold the new
    // template, so the negative below cannot pass against a torn-down editor.
    await expect(canvas).toContainText("Reset Your Password");
    await expect(canvas).not.toContainText("Introducing Launchpad v2.0");
    await expect(picker).toHaveValue("password-reset");
    await expect(activeRailItem).toHaveText("Saved blocks");

    // The pick belongs to the capability it was made in: Comments opens on
    // the fixture it curated, not on the one left behind next door.
    await page
      .locator(SELECTORS.capabilityRailItem, { hasText: "Comments" })
      .click();
    await expect(activeRailItem).toHaveText("Comments");
    await expect(canvas).toContainText("Introducing Launchpad v2.0");
    await expect(canvas).not.toContainText("Reset Your Password");
    await expect(picker).toHaveValue("product-launch");
  });
});
