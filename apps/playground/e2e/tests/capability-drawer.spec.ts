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
    // Anchored on the tab's own label rather than `.first()`, so the
    // assertion keeps naming a specific tab if the bar ever gains one.
    const tabs = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Controls",
    });

    await expect(pane).toBeVisible();
    await toggle.click();
    await expect(pane).toBeHidden();
    await expect(tabs).toBeVisible();

    // The drawer is always re-openable from the same toggle.
    await toggle.click();
    await expect(pane).toBeVisible();
    await expect(tabs).toBeVisible();
  });

  test("the handle resizes by keyboard, and the height survives a reload", async ({
    page,
  }) => {
    await page.goto("/#capabilities");
    const handle = page.locator(SELECTORS.capabilityDrawerResize);

    // A pointer-only handle is unreachable by keyboard, so the arrow keys are
    // the accessible path rather than a convenience.
    await expect(handle).toHaveAttribute("aria-valuenow", "280");
    await handle.focus();
    await handle.press("ArrowUp");
    await expect(handle).toHaveAttribute("aria-valuenow", "296");

    // Drawer chrome persists under its own key, never `tpl-playground-config`
    // — that one is capability control state, which e2e helpers seed.
    expect(
      await page.evaluate(() =>
        localStorage.getItem("tpl-playground-drawer"),
      ),
    ).toBe(
      JSON.stringify({ open: true, height: 296, activeTab: "controls" }),
    );

    await page.reload();
    await expect(page.locator(SELECTORS.capabilityDrawerResize)).toHaveAttribute(
      "aria-valuenow",
      "296",
    );
  });

  /**
   * Pointer-drag resize. Light DOM, no Sortable — a plain mouse-stepped drag
   * reaches the `window` pointermove listeners directly, so none of the
   * fallback-Sortable choreography in `editor.page.ts` applies here.
   *
   * Coordinates are rounded off the handle's own box so the delta is exactly
   * the number asserted: the handle is 6px tall, so a drag measured from its
   * top edge rather than its centre lands 3px off and the height with it.
   */
  test("the handle resizes by pointer drag, committing once on release", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __drawerWrites: number };
      w.__drawerWrites = 0;
      const store = window.localStorage;
      const original = store.setItem.bind(store);
      store.setItem = (key: string, value: string) => {
        if (key === "tpl-playground-drawer") w.__drawerWrites += 1;
        original(key, value);
      };
    });
    await page.goto("/#capabilities");

    const handle = page.locator(SELECTORS.capabilityDrawerResize);
    await expect(handle).toHaveAttribute("aria-valuenow", "280");

    const box = (await handle.boundingBox())!;
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    // Up the page grows the drawer: the handle sits on its top edge.
    await page.mouse.move(x, y - 60, { steps: 10 });
    await page.mouse.up();

    await expect(handle).toHaveAttribute("aria-valuenow", "340");
    expect(
      await page.evaluate(() =>
        localStorage.getItem("tpl-playground-drawer"),
      ),
    ).toBe(
      JSON.stringify({ open: true, height: 340, activeTab: "controls" }),
    );

    // One write for the whole gesture. Persisting per `pointermove` would put
    // a synchronous `setItem` on every frame of the drag.
    expect(
      await page.evaluate(
        () => (window as unknown as { __drawerWrites: number }).__drawerWrites,
      ),
    ).toBe(1);
  });

  test("a drag past the maximum stops at the bound", async ({ page }) => {
    await page.goto("/#capabilities");
    const handle = page.locator(SELECTORS.capabilityDrawerResize);
    // The bound the drag is about to hit, read off the handle itself — so a
    // changed maximum shows up here as a failure rather than a silent pass.
    await expect(handle).toHaveAttribute("aria-valuemax", "480");
    await expect(handle).toHaveAttribute("aria-valuemin", "160");

    const box = (await handle.boundingBox())!;
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    // Far past 480 — unclamped this would be 880.
    await page.mouse.move(x, y - 600, { steps: 10 });
    await page.mouse.up();

    await expect(handle).toHaveAttribute("aria-valuenow", "480");
  });

  test("a cancelled drag releases the body and stops tracking", async ({
    page,
  }) => {
    await page.goto("/#capabilities");
    const handle = page.locator(SELECTORS.capabilityDrawerResize);

    const box = (await handle.boundingBox())!;
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 40, { steps: 5 });

    // Positive control: the drag really is in progress, so the assertions
    // after the cancel are about teardown rather than about nothing.
    await expect(handle).toHaveAttribute("aria-valuenow", "320");
    expect(await page.evaluate(() => document.body.style.cursor)).toBe(
      "row-resize",
    );

    // The browser fires this instead of `pointerup` when it takes the pointer
    // away. A teardown listening only for `pointerup` leaves `<body>` stuck
    // at `row-resize; user-select: none` for the rest of the session.
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent("pointercancel")),
    );
    expect(await page.evaluate(() => document.body.style.cursor)).toBe("");
    expect(await page.evaluate(() => document.body.style.userSelect)).toBe("");

    // The window listeners are gone with it: further movement no longer resizes.
    await page.mouse.move(x, y - 240, { steps: 5 });
    await page.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", "320");
  });

  test("a stored height beyond the maximum is clamped on read", async ({
    page,
  }) => {
    // The drawer is `shrink-0`, so an unclamped 5000 collapses `<main>` and
    // the editor with it — the whole page becomes a drawer.
    await page.addInitScript(() => {
      localStorage.setItem(
        "tpl-playground-drawer",
        JSON.stringify({ open: true, height: 5000 }),
      );
    });
    await page.goto("/#capabilities");

    await expect(page.locator(SELECTORS.capabilityDrawerResize)).toHaveAttribute(
      "aria-valuenow",
      "480",
    );

    const editor = page.locator(SELECTORS.capabilityEditor);
    await expect(editor).toBeVisible();
    expect(
      await editor.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThan(100);
  });

  test("a collapsed drawer comes back collapsed after a reload", async ({
    page,
  }) => {
    await page.goto("/#capabilities");
    const toggle = page.locator(SELECTORS.capabilityDrawerToggle);

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await page.reload();
    await expect(page.locator(SELECTORS.capabilityDrawerToggle)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator(SELECTORS.capabilityDrawerPane)).toBeHidden();
    // The tab bar stays reachable while collapsed, so the drawer is always
    // re-openable without hunting for the toggle.
    await expect(
      page.locator(SELECTORS.capabilityDrawerTab, { hasText: "Controls" }),
    ).toBeVisible();
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

  test("the active tab survives a reload", async ({ page }) => {
    await page.goto("/#capabilities");
    const configTab = page.locator(SELECTORS.capabilityDrawerTab, {
      hasText: "Config",
    });

    await configTab.click();
    await expect(configTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(SELECTORS.capabilityConfigSource)).toContainText(
      "savedBlocks:",
    );

    await page.reload();
    await expect(
      page.locator(SELECTORS.capabilityDrawerTab, { hasText: "Config" }),
    ).toHaveAttribute("aria-selected", "true");
    // The pane, not just the button: a tab that reports selected while showing
    // another tab's content is the exact failure the tab table exists to stop.
    await expect(page.locator(SELECTORS.capabilityConfigSource)).toContainText(
      "savedBlocks:",
    );
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

  test("the capability keys are printed above the template content", async ({
    page,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    await page
      .locator(SELECTORS.capabilityDrawerTab, { hasText: "Config" })
      .click();

    const source = page.locator(SELECTORS.capabilityConfigSource);
    // Positive first: the pane holds real source, so the ordering assertions
    // below cannot pass against an element that has not rendered.
    await expect(source).toContainText("savedBlocks:");

    // Top-level keys are the lines `renderConfig` indents by exactly two
    // spaces — anchoring there rather than on a bare substring keeps a
    // `content:` nested inside some other value out of the comparison.
    const lines = (await source.evaluate((el) => el.textContent ?? "")).split(
      "\n",
    );
    const capabilityLine = lines.findIndex((line) =>
      line.startsWith("  savedBlocks:"),
    );
    const contentLine = lines.findIndex((line) => line.startsWith("  content:"));

    expect(capabilityLine).toBeGreaterThan(-1);
    expect(contentLine).toBeGreaterThan(-1);
    expect(capabilityLine).toBeLessThan(contentLine);

    // The pane is ~10 lines tall at `text-[12px]`, so a capability key that
    // sits below the content — hundreds of lines of blocks — is unreachable
    // without scrolling the demo it exists to show.
    expect(capabilityLine).toBeLessThan(10);
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

  test("saving a block reports onCreated to the Events tab, and Clear empties it", async ({
    page,
    editorPage,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    await page
      .locator(SELECTORS.capabilityDrawerTab, { hasText: "Events" })
      .click();
    await expect(page.locator(SELECTORS.capabilityEvent)).toHaveCount(0);

    // Drive the real feature end to end. Reaching into the provider directly
    // would prove nothing: the claim is that the EDITOR fired the handler.
    await editorPage.selectBlock(0);
    await page.locator(SELECTORS.savedBlocksSaveAction).click();
    await page.locator(SELECTORS.savedBlocksPickConfirm).click();

    // Scoped to the dialog: text inputs are used widely elsewhere in the
    // editor, and "Save Block" also labels the pick bar's confirm button.
    const dialog = page.locator('[role="dialog"]', {
      has: page.locator(SELECTORS.saveBlockDialogTitle),
    });
    await dialog.locator(SELECTORS.savedBlocksNameInput).fill("Header group");
    await dialog
      .getByRole("button", { name: "Save Block", exact: true })
      .click();

    const event = page.locator(SELECTORS.capabilityEvent).first();
    await expect(event).toHaveAttribute("data-event-handler", "onCreated");
    await expect(event).toHaveAttribute("data-event-capability", "saved-blocks");
    // The summary is the block's own name, so this fails if the capability
    // reports a placeholder or the wrong field.
    await expect(event).toContainText("Header group");
    await expect(event).toContainText("local");

    await page.locator(SELECTORS.capabilityEventsClear).click();
    await expect(page.locator(SELECTORS.capabilityEvent)).toHaveCount(0);
    await expect(page.locator(SELECTORS.capabilityEventsEmpty)).toBeVisible();
  });

  test("the Events tab names the remote gap a single-browser demo cannot fill", async ({
    page,
  }) => {
    await page.goto("/#capabilities/saved-blocks");
    await page
      .locator(SELECTORS.capabilityDrawerTab, { hasText: "Events" })
      .click();

    // The feed carries only what this browser caused, and says so rather than
    // leaving a reader to infer that `remote` is unreachable here. No
    // synthetic event exists anywhere to fill the gap.
    const note = page.locator(SELECTORS.capabilityEventsRemoteNote);
    await expect(note).toBeVisible();
    await expect(note).toContainText("local");
    await expect(note).toContainText("remote");
    await expect(note).toContainText("subscribe");

    await expect(page.locator(SELECTORS.capabilityEventsEmpty)).toBeVisible();
    await expect(page.locator(SELECTORS.capabilityEvent)).toHaveCount(0);
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
