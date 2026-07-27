import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";

/**
 * Saved blocks in the OSS editor, backed by the playground's always-on
 * `createLocalStorageSavedBlocksProvider()`.
 *
 * Seeding goes through `addInitScript` so the store is populated before any
 * page JS runs — the provider is read during the editor's mount, so setting
 * localStorage after `goto()` would race the initial load.
 */

const STORE_KEY = "templatical:saved-blocks";

/** Padding matches what the block factories emit, so the canvas renders it. */
const PAD = { padding: { top: 10, right: 10, bottom: 10, left: 10 } };

const SEEDED = [
  {
    id: "seed-hero",
    name: "Hero Header",
    content: [
      {
        id: "stored-title-1",
        type: "title",
        content: "<p>Seeded hero</p>",
        level: 2,
        textAlign: "left",
        styles: PAD,
      },
      {
        id: "stored-para-1",
        type: "paragraph",
        content: "<p>Seeded paragraph</p>",
        styles: PAD,
      },
    ],
    // Distinct from Footer CTA so the relative-timestamp label has real data;
    // list order comes from this array, not from the timestamps.
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "seed-footer",
    name: "Footer CTA",
    content: [
      {
        id: "stored-title-2",
        type: "title",
        content: "<p>Footer heading</p>",
        level: 3,
        textAlign: "center",
        styles: PAD,
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

async function seedSavedBlocks(page: Page, entries: unknown[]): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key as string, value as string);
    },
    [STORE_KEY, JSON.stringify(entries)] as const,
  );
}

async function clearSavedBlocks(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.removeItem(key as string);
  }, STORE_KEY);
}

test.describe("saved blocks", () => {
  test("hides the browser rail when nothing is saved", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await clearSavedBlocks(page);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // The palette rail is present, but the saved-blocks entry is not — the
    // count gate keeps it hidden until something exists to browse.
    await expect(page.locator(SELECTORS.sidebarRail)).toBeVisible();
    await expect(page.locator(SELECTORS.savedBlocksRailBtn)).toHaveCount(0);
  });

  test("lists saved blocks and inserts one with fresh block ids", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await seedSavedBlocks(page, SEEDED);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Rail appears once the provider's list resolves.
    const rail = page.locator(SELECTORS.savedBlocksRailBtn);
    await expect(rail).toBeVisible();

    const idsBefore = await editorPage.getTopLevelBlockIds();
    const countBefore = idsBefore.length;

    await rail.click();

    // The browser modal is a lazily-loaded chunk; wait for its heading.
    await expect(page.locator(SELECTORS.savedBlocksBrowserTitle)).toBeVisible();

    const cards = page.locator(SELECTORS.savedBlocksCard);
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText("Hero Header");
    await expect(cards.first()).toContainText("2 block(s)");

    // Select "Hero Header" and insert it at the beginning.
    await cards.first().click();
    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator("select")
      .selectOption("beginning");
    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .getByRole("button", { name: "Insert", exact: true })
      .click();

    // Modal closes and the two stored blocks land on the canvas.
    await expect(
      page.locator(SELECTORS.savedBlocksBrowserTitle),
    ).toBeHidden();
    await expect
      .poll(() => editorPage.getTopLevelBlockIds().then((ids) => ids.length))
      .toBe(countBefore + 2);

    const idsAfter = await editorPage.getTopLevelBlockIds();
    const added = idsAfter.filter((id) => !idsBefore.includes(id));
    expect(added).toHaveLength(2);

    // Fresh ids: the stored copy's ids must never reach the canvas, or a second
    // insert of the same entry would collide.
    expect(added).not.toContain("stored-title-1");
    expect(added).not.toContain("stored-para-1");

    // Inserted at the beginning, in stored order.
    const types = await editorPage.getTopLevelBlockTypes();
    expect(types.slice(0, 2)).toEqual(["title", "paragraph"]);

    // The store itself is untouched by an insert.
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
      STORE_KEY,
    );
    expect(stored).toHaveLength(2);
    expect(stored[0].content.map((b: { id: string }) => b.id)).toEqual([
      "stored-title-1",
      "stored-para-1",
    ]);
  });

  test("renames a saved block through the provider", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await seedSavedBlocks(page, SEEDED);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowserTitle)).toBeVisible();

    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator(SELECTORS.savedBlocksRenameBtn)
      .first()
      .click();

    const input = page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator('input[aria-label="Rename"]');
    await expect(input).toBeVisible();
    await input.fill("Renamed Hero");
    await input.press("Enter");

    // The card reflects the new name...
    await expect(page.locator(SELECTORS.savedBlocksCard).first()).toContainText(
      "Renamed Hero",
    );

    // ...and the provider persisted it.
    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
          STORE_KEY,
        );
        return stored.find((e: { id: string }) => e.id === "seed-hero")?.name;
      })
      .toBe("Renamed Hero");
  });

  test("deletes a saved block after confirmation", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await seedSavedBlocks(page, SEEDED);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowserTitle)).toBeVisible();
    await expect(page.locator(SELECTORS.savedBlocksCard)).toHaveCount(2);

    // First click arms the confirmation; only the second deletes.
    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator(SELECTORS.savedBlocksDeleteBtn)
      .first()
      .click();
    await expect(page.locator(SELECTORS.savedBlocksCard)).toHaveCount(2);

    // Target the aria-label directly: the card's accessible name absorbs its
    // child button text, so a role+name lookup would match the card too.
    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator('button[aria-label="Delete this saved block?"]')
      .click();

    await expect(page.locator(SELECTORS.savedBlocksCard)).toHaveCount(1);
    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
          STORE_KEY,
        );
        return stored.map((e: { id: string }) => e.id);
      })
      .toEqual(["seed-footer"]);
  });
});

/**
 * The canvas pick session — the flow that replaced the save dialog's checklist.
 *
 * The checklist labelled rows `"${type} ${index + 1}"`, so with several same-type
 * blocks in a row you couldn't tell which row was which block. Picking happens on
 * the canvas instead, where the user's mental model already is.
 */
test.describe("saved blocks — pick session", () => {
  async function bootEmptyStore(page: Page): Promise<void> {
    await clearSavedBlocks(page);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
  }

  /** Select the first block and start a session from its bookmark action. */
  async function startSession(
    page: Page,
    editorPage: { selectBlock(i: number): Promise<void> },
  ): Promise<void> {
    await editorPage.selectBlock(0);
    await page.locator(SELECTORS.savedBlocksSaveAction).click();
    await expect(page.locator(SELECTORS.savedBlocksPickBar)).toBeVisible();
  }

  test("picks multiple blocks on the canvas and saves them", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootEmptyStore(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // No rail yet — nothing saved.
    await expect(page.locator(SELECTORS.savedBlocksRailBtn)).toHaveCount(0);

    await startSession(page, editorPage);
    await expect(page.locator(SELECTORS.savedBlocksPickCount)).toContainText(
      "1",
    );
    // The seeding block is marked, and the action bar steps aside for the mode.
    await expect(page.locator(SELECTORS.blockPicked)).toHaveCount(1);
    await expect(page.locator(SELECTORS.blockActions)).toHaveCount(0);

    // Pick two more by plain clicks — no modifier keys.
    const blocks = editorPage.getTopLevelBlocks();
    await blocks.nth(1).click({ position: { x: 5, y: 5 } });
    await blocks.nth(2).click({ position: { x: 5, y: 5 } });
    await expect(page.locator(SELECTORS.savedBlocksPickCount)).toContainText(
      "3",
    );
    await expect(page.locator(SELECTORS.blockPicked)).toHaveCount(3);

    // Clicking a picked block again removes it.
    await blocks.nth(2).click({ position: { x: 5, y: 5 } });
    await expect(page.locator(SELECTORS.savedBlocksPickCount)).toContainText(
      "2",
    );

    await page.locator(SELECTORS.savedBlocksPickConfirm).click();

    // Bar gives way to the name-only dialog, which reports what it's saving.
    await expect(page.locator(SELECTORS.savedBlocksPickBar)).toHaveCount(0);
    await expect(page.locator(SELECTORS.saveBlockDialogTitle)).toBeVisible();
    await expect(page.locator(SELECTORS.savedBlocksSaveSummary)).toContainText(
      "2",
    );
    // Everything below is scoped to the dialog: ToggleSwitch and text inputs are
    // used widely elsewhere in the editor, and "Save Block" also labels the pick
    // bar's confirm button.
    const dialog = page.locator('[role="dialog"]', {
      has: page.locator(SELECTORS.saveBlockDialogTitle),
    });
    // The checklist is gone for good.
    await expect(dialog.locator('button[role="switch"]')).toHaveCount(0);

    await dialog
      .locator(SELECTORS.savedBlocksNameInput)
      .fill("Header group");
    await dialog
      .getByRole("button", { name: "Save Block", exact: true })
      .click();

    // Persisted with exactly the two picked blocks.
    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
          STORE_KEY,
        );
        return stored.map((e: { name: string; content: unknown[] }) => [
          e.name,
          e.content.length,
        ]);
      })
      .toEqual([["Header group", 2]]);

    // And the rail now appears, since the store is no longer empty.
    await expect(page.locator(SELECTORS.savedBlocksRailBtn)).toBeVisible();
  });

  test("Cancel leaves the store and the canvas untouched", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootEmptyStore(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const idsBefore = await editorPage.getTopLevelBlockIds();

    await startSession(page, editorPage);
    await editorPage.getTopLevelBlocks().nth(1).click({ position: { x: 5, y: 5 } });
    await expect(page.locator(SELECTORS.savedBlocksPickCount)).toContainText(
      "2",
    );

    await page.locator(SELECTORS.savedBlocksPickCancel).click();

    await expect(page.locator(SELECTORS.savedBlocksPickBar)).toHaveCount(0);
    await expect(page.locator(SELECTORS.blockPicked)).toHaveCount(0);
    await expect(page.locator(SELECTORS.saveBlockDialogTitle)).toHaveCount(0);
    // Nothing saved, nothing moved.
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
      STORE_KEY,
    );
    expect(stored).toEqual([]);
    expect(await editorPage.getTopLevelBlockIds()).toEqual(idsBefore);
  });

  test("Escape cancels the session", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootEmptyStore(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await startSession(page, editorPage);
    await page.keyboard.press("Escape");

    await expect(page.locator(SELECTORS.savedBlocksPickBar)).toHaveCount(0);
    await expect(page.locator(SELECTORS.blockPicked)).toHaveCount(0);
  });

  /**
   * The dialog previews the picks in the order they were picked — not canvas
   * order — and lets that order be dragged before saving.
   *
   * Sortable runs in force-fallback (pointer-event) mode, so `locator.dragTo`
   * can't drive it: the drag is mouse-stepped like `EditorPage.reorderBlock`.
   */
  test("previews picks in pick order and saves the dragged order", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootEmptyStore(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const canvasIds = await editorPage.getTopLevelBlockIds();
    expect(canvasIds.length).toBeGreaterThanOrEqual(3);

    await startSession(page, editorPage);

    // Pick the THIRD block before the SECOND, so pick order and canvas order
    // disagree — that disagreement is the whole point of the assertion below.
    const blocks = editorPage.getTopLevelBlocks();
    await blocks.nth(2).click({ position: { x: 5, y: 5 } });
    await blocks.nth(1).click({ position: { x: 5, y: 5 } });
    await expect(page.locator(SELECTORS.savedBlocksPickCount)).toContainText(
      "3",
    );

    await page.locator(SELECTORS.savedBlocksPickConfirm).click();
    await expect(page.locator(SELECTORS.saveBlockDialogTitle)).toBeVisible();

    const dialog = page.locator('[role="dialog"]', {
      has: page.locator(SELECTORS.saveBlockDialogTitle),
    });
    const rows = dialog.locator(SELECTORS.savedBlocksReorderRow);
    await expect(rows).toHaveCount(3);

    const rowIds = () =>
      rows.evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-block-id") ?? ""),
      );

    const pickOrder = [canvasIds[0], canvasIds[2], canvasIds[1]];
    expect(await rowIds()).toEqual(pickOrder);
    // Guard against a vacuous pass: pick order must differ from canvas order,
    // or this test would also pass with the old document-order derivation.
    expect(pickOrder).not.toEqual(canvasIds.slice(0, 3));

    // Drag the first row past the second.
    const handle = rows.nth(0).locator(SELECTORS.savedBlocksReorderHandle);
    const handleBox = await handle.boundingBox();
    const targetBox = await rows.nth(1).boundingBox();
    if (!handleBox || !targetBox) throw new Error("Drag bounds unavailable");

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const endX = targetBox.x + targetBox.width / 2;
    // Just past the target's midpoint — that's the threshold Sortable swaps on.
    // Aiming at the target's bottom edge instead overshoots: the list reflows
    // the moment the first swap lands, and the pointer ends up past the NEXT
    // row's midpoint too, producing a two-position move. Rows here are
    // block-sized and uneven, so the margin for that is small.
    const endY = targetBox.y + targetBox.height / 2 + 4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await page.mouse.move(
        startX + (endX - startX) * t,
        startY + (endY - startY) * t,
      );
    }
    await page.mouse.up();

    const draggedOrder = [canvasIds[2], canvasIds[0], canvasIds[1]];
    await expect.poll(rowIds, { timeout: 5000 }).toEqual(draggedOrder);

    await dialog
      .locator(SELECTORS.savedBlocksNameInput)
      .fill("Dragged group");
    await dialog
      .getByRole("button", { name: "Save Block", exact: true })
      .click();

    // Persisted in the dragged order, with the canvas block ids intact (the
    // provider stores content verbatim; ids are only regenerated on insert).
    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
          STORE_KEY,
        );
        return stored.map((e: { name: string; content: { id: string }[] }) => [
          e.name,
          e.content.map((b) => b.id),
        ]);
      })
      .toEqual([["Dragged group", draggedOrder]]);
  });

  test("clicking inside a section picks the whole section, not the child", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootEmptyStore(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await startSession(page, editorPage);

    // Click a block nested in a section column.
    const child = page
      .locator('[data-block-type="section"] .tpl-block-content .tpl-block')
      .first();
    await child.click({ position: { x: 5, y: 5 } });

    // Two picks: the seeding block plus the section — never the child itself.
    await expect(page.locator(SELECTORS.savedBlocksPickCount)).toContainText(
      "2",
    );
    // The section element itself carries the picked state — a stronger check
    // than looking for a marker somewhere inside it.
    await expect(
      page.locator(`[data-block-type="section"]${SELECTORS.blockPicked}`),
    ).toHaveCount(1);
  });
});

/**
 * Categories: optional free-text grouping. Filtering runs in the editor over
 * whatever `list()` returned, so the provider stays a dumb store.
 */
test.describe("saved blocks — categories", () => {
  const CATEGORISED = [
    {
      id: "seed-promo",
      name: "Spring promo",
      category: "Promos",
      content: [
        {
          id: "cat-title-1",
          type: "title",
          content: "<p>Promo</p>",
          level: 2,
          textAlign: "left",
          styles: PAD,
        },
      ],
    },
    {
      id: "seed-head",
      name: "Main header",
      category: "Headers",
      content: [
        {
          id: "cat-title-2",
          type: "title",
          content: "<p>Header</p>",
          level: 2,
          textAlign: "left",
          styles: PAD,
        },
      ],
    },
    {
      id: "seed-plain",
      name: "Uncategorised bit",
      content: [
        {
          id: "cat-title-3",
          type: "title",
          content: "<p>Plain</p>",
          level: 3,
          textAlign: "left",
          styles: PAD,
        },
      ],
    },
  ];

  async function openBrowser(
    page: Page,
    chooserPage: { goto(): Promise<void>; selectFirstTemplate(): Promise<void> },
    editorPage: { waitForReady(): Promise<void>; dismissOverlays(): Promise<void> },
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowserTitle)).toBeVisible();
  }

  test("filters the browser by category and composes with search", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await seedSavedBlocks(page, CATEGORISED);
    await openBrowser(page, chooserPage, editorPage);

    const cards = page.locator(SELECTORS.savedBlocksCard);
    await expect(cards).toHaveCount(3);

    // Options are derived from the entries, so exactly the used ones appear.
    const filter = page.locator(SELECTORS.savedBlocksCategoryFilter);
    await expect(filter.locator("option")).toHaveText([
      "All categories",
      "Headers",
      "Promos",
    ]);

    await filter.selectOption("Promos");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Spring promo");

    // Search narrows further, and the two compose rather than replacing.
    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator('input[type="text"]')
      .fill("zzz");
    await expect(cards).toHaveCount(0);

    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator('input[type="text"]')
      .fill("");
    await filter.selectOption("");
    await expect(cards).toHaveCount(3);
  });

  test("saves a new block with a category and filters by it", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await clearSavedBlocks(page);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await editorPage.selectBlock(0);
    await page.locator(SELECTORS.savedBlocksSaveAction).click();
    await page.locator(SELECTORS.savedBlocksPickConfirm).click();

    const dialog = page.locator('[role="dialog"]', {
      has: page.locator(SELECTORS.saveBlockDialogTitle),
    });
    await dialog.locator(SELECTORS.savedBlocksNameInput).fill("Categorised");
    await dialog.locator(SELECTORS.savedBlocksCategoryInput).fill("Promos");
    await dialog
      .getByRole("button", { name: "Save Block", exact: true })
      .click();

    // Persisted with the category attached.
    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
          STORE_KEY,
        );
        return stored.map((e: { name: string; category?: string }) => [
          e.name,
          e.category,
        ]);
      })
      .toEqual([["Categorised", "Promos"]]);

    // And it shows on the card in the browser.
    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksCategoryBadge)).toHaveText(
      "Promos",
    );
  });

  test("saves without a category when the field is left empty", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await clearSavedBlocks(page);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await editorPage.selectBlock(0);
    await page.locator(SELECTORS.savedBlocksSaveAction).click();
    await page.locator(SELECTORS.savedBlocksPickConfirm).click();

    const dialog = page.locator('[role="dialog"]', {
      has: page.locator(SELECTORS.saveBlockDialogTitle),
    });
    await dialog.locator(SELECTORS.savedBlocksNameInput).fill("Plain");
    await dialog
      .getByRole("button", { name: "Save Block", exact: true })
      .click();

    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
          STORE_KEY,
        );
        return stored.map((e: Record<string, unknown>) => "category" in e);
      })
      .toEqual([false]);

    // With nothing categorised, the filter isn't rendered at all.
    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowserTitle)).toBeVisible();
    await expect(
      page.locator(SELECTORS.savedBlocksCategoryFilter),
    ).toHaveCount(0);
  });

  test("recategorises an existing block inline", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await seedSavedBlocks(page, CATEGORISED);
    await openBrowser(page, chooserPage, editorPage);

    await page
      .locator(SELECTORS.savedBlocksBrowser)
      .locator(SELECTORS.savedBlocksRenameBtn)
      .first()
      .click();

    const categoryInput = page.locator(SELECTORS.savedBlocksEditCategory);
    await expect(categoryInput).toHaveValue("Promos");
    await categoryInput.fill("Footers");
    await categoryInput.press("Enter");

    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
          STORE_KEY,
        );
        return stored.find((e: { id: string }) => e.id === "seed-promo")
          ?.category;
      })
      .toBe("Footers");

    // The filter options follow the change — "Promos" no longer exists.
    await expect(
      page.locator(SELECTORS.savedBlocksCategoryFilter).locator("option"),
    ).toHaveText(["All categories", "Footers", "Headers"]);
  });
});

/**
 * A provider that withholds its mutations by passing `false` instead of a
 * function. The editor hides every affordance that would need them, while
 * browsing, previewing and inserting keep working — insertion only touches the
 * canvas, never the store.
 */
test.describe("saved blocks — read-only library", () => {
  async function bootReadOnly(page: Page): Promise<void> {
    await seedSavedBlocks(page, SEEDED);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
      localStorage.setItem("tpl-playground-saved-blocks-readonly", "true");
    });
  }

  test("hides the save action so no pick session can start", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootReadOnly(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await editorPage.selectBlock(0);

    // The bookmark is gone...
    await expect(page.locator(SELECTORS.savedBlocksSaveAction)).toHaveCount(0);
    // ...but the rest of the block chrome is intact, so this is a targeted gate.
    await expect(page.locator(SELECTORS.blockActions)).toHaveCount(1);
    await expect(page.locator(SELECTORS.savedBlocksPickBar)).toHaveCount(0);
  });

  test("browses and inserts, with no rename or delete controls", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootReadOnly(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const idsBefore = await editorPage.getTopLevelBlockIds();

    // The rail still appears — there is something to browse.
    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowserTitle)).toBeVisible();

    const browser = page.locator(SELECTORS.savedBlocksBrowser);
    await expect(page.locator(SELECTORS.savedBlocksCard)).toHaveCount(2);
    await expect(
      browser.locator(SELECTORS.savedBlocksRenameBtn),
    ).toHaveCount(0);
    await expect(
      browser.locator(SELECTORS.savedBlocksDeleteBtn),
    ).toHaveCount(0);

    // Insertion is unaffected: it never calls the provider.
    await page.locator(SELECTORS.savedBlocksCard).first().click();
    await browser
      .getByRole("button", { name: "Insert", exact: true })
      .click();

    await expect
      .poll(() => editorPage.getTopLevelBlockIds().then((ids) => ids.length))
      .toBe(idsBefore.length + 2);

    // And the store is untouched by the whole session.
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key as string) ?? "[]"),
      STORE_KEY,
    );
    expect(stored).toHaveLength(2);
  });
});
