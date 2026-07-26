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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
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
