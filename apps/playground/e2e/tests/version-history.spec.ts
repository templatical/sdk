import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { ScenePage } from "../pages/scene.page";

/**
 * The BYO version-history provider in the OSS editor, backed by the playground's
 * localStorage store (`versionHistoryProviderFor` in `apps/playground/src/host/providers.ts`).
 *
 * The demo's *templates* provider is what records versions — one per save, the
 * arrangement the contract prescribes — so history fills up by using the editor
 * rather than through any test-only hook. Its `list()` hydrates only the newest
 * five entries, so both resolution paths are reachable here: the `content` hint
 * and the `get` fallback.
 *
 * What the playground can express bounds this spec. `restore: false` is reachable
 * through a storage flag; `create: false`, a rejected `get` and the cache's
 * behaviour on a second visit stay in `useVersionHistoryFeature.test.ts` /
 * `version-history.test.ts`, where they don't need test-only UI in front of
 * visitors.
 */

const VERSIONS_KEY = "templatical:versions:version-history";
const TEMPLATE_KEY = "templatical:template:version-history";

/** How many entries the demo store hydrates — mirrors `HYDRATED_VERSIONS`. */
const HYDRATED = 5;

type StoredVersion = { id: string; content: { blocks: unknown[] } };

async function readVersions(page: Page): Promise<StoredVersion[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredVersion[]) : [];
  }, VERSIONS_KEY);
}

async function readStoredBlockCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw
      ? (JSON.parse(raw) as { content: { blocks: unknown[] } }).content.blocks
          .length
      : -1;
  }, TEMPLATE_KEY);
}

async function openVersionHistoryScene(
  page: Page,
  shadowDom: boolean,
  editorPage: {
    waitForReady: () => Promise<void>;
    dismissOverlays: () => Promise<void>;
  },
  query: Record<string, string> = {},
): Promise<void> {
  await new ScenePage(page, { shadowDom }).goto("version-history", query);
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
}

/** Duplicate a block, then save — one edit, one recorded version. */
async function editAndSave(
  page: Page,
  editorPage: {
    selectBlock: (index: number) => Promise<void>;
    duplicateSelectedBlock: () => Promise<void>;
  },
  expectedVersionCount: number,
): Promise<void> {
  await editorPage.selectBlock(0);
  await editorPage.duplicateSelectedBlock();
  await page.locator(SELECTORS.templateSave).click();
  await expect
    .poll(async () => (await readVersions(page)).length)
    .toBe(expectedVersionCount);
}

test.describe("version history provider", () => {
  test.describe("version-history scene", () => {
    test.beforeEach(async ({ page, shadowDom, editorPage }) => {
      await openVersionHistoryScene(page, shadowDom, editorPage);
    });

    test("the control renders once a template is attached, with no versions yet", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      await expect(page.locator(SELECTORS.versionHistory)).toBeVisible();

      await page.locator(SELECTORS.versionHistoryToggle).click();
      await expect(
        page.locator(SELECTORS.versionHistoryDropdown),
      ).toBeVisible();
      await expect(page.locator(SELECTORS.versionHistoryEmpty)).toBeVisible();
      await expect(page.locator(SELECTORS.versionHistoryEntry)).toHaveCount(0);
    });

    test("a save records a version, and it is listed as automatic", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      await editAndSave(page, editorPage, 1);

      await page.locator(SELECTORS.versionHistoryToggle).click();
      await expect(page.locator(SELECTORS.versionHistoryEntry)).toHaveCount(1);
      // `isAutomatic` came from the store, not from the editor — nothing in the
      // editor decides that a save is worth a version.
      await expect(page.locator(SELECTORS.versionHistoryEntry)).toContainText(
        "auto",
      );
    });

    test("previewing a version swaps the canvas, and Cancel puts the work back", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      const blocksAtStart = await editorPage.getBlockCount();
      await editAndSave(page, editorPage, 1);
      await editAndSave(page, editorPage, 2);
      expect(await editorPage.getBlockCount()).toBe(blocksAtStart + 2);

      const [, older] = await readVersions(page);
      await page.locator(SELECTORS.versionHistoryToggle).click();
      await page.locator(`[data-version-id="${older.id}"]`).click();

      await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeVisible();
      await expect
        .poll(() => editorPage.getBlockCount())
        .toBe(blocksAtStart + 1);

      await page.locator(SELECTORS.versionPreviewCancel).click();

      await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeHidden();
      await expect
        .poll(() => editorPage.getBlockCount())
        .toBe(blocksAtStart + 2);
    });

    test("Restore makes the version current and appends to history", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      const blocksAtStart = await editorPage.getBlockCount();
      // The canvas counts nested blocks too, so the stored top-level count needs
      // its own baseline rather than being derived from the canvas one.
      const storedAtStart = await readStoredBlockCount(page);
      await editAndSave(page, editorPage, 1);
      await editAndSave(page, editorPage, 2);

      const [, older] = await readVersions(page);
      await page.locator(SELECTORS.versionHistoryToggle).click();
      await page.locator(`[data-version-id="${older.id}"]`).click();
      await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeVisible();

      await page.locator(SELECTORS.versionPreviewRestore).click();

      await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeHidden();
      await expect
        .poll(() => editorPage.getBlockCount())
        .toBe(blocksAtStart + 1);
      await expect
        .poll(() => readStoredBlockCount(page))
        .toBe(storedAtStart + 1);

      // Append-only: the restore added an entry rather than rewriting one, so the
      // version that was restored *from* is still there to go back to.
      await expect.poll(async () => (await readVersions(page)).length).toBe(3);
      await page.locator(SELECTORS.versionHistoryToggle).click();
      await expect(page.locator(SELECTORS.versionHistoryEntry)).toHaveCount(3);
    });

    test("a version the store did not hydrate is fetched through get()", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      const blocksAtStart = await editorPage.getBlockCount();
      const storedAtStart = await readStoredBlockCount(page);
      // One past the hydration cut-off, so the oldest entry arrives with no
      // `content` and can only be previewed by resolving `get`.
      for (let i = 1; i <= HYDRATED + 1; i++) {
        await editAndSave(page, editorPage, i);
      }

      const versions = await readVersions(page);
      const oldest = versions[versions.length - 1];
      expect(oldest.content.blocks.length).toBe(storedAtStart + 1);

      await page.locator(SELECTORS.versionHistoryToggle).click();
      await page.locator(`[data-version-id="${oldest.id}"]`).click();

      await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeVisible();
      await expect
        .poll(() => editorPage.getBlockCount())
        .toBe(blocksAtStart + 1);
    });

    /**
     * Confirming a restore discards the pre-preview backup, so unsaved work would
     * then exist nowhere. The editor does not cover that by recording a version of
     * its own — it never authors versions — so it asks, and offers to put the work
     * through the ordinary save first.
     */
    test.describe("restoring with unsaved changes", () => {
      test("saves the unsaved work first, then restores", async ({
        editorPage,
      }) => {
        const page = editorPage.page;

        const blocksAtStart = await editorPage.getBlockCount();
        const storedAtStart = await readStoredBlockCount(page);
        await editAndSave(page, editorPage, 1);

        // A second edit, left unsaved — this is what a restore would discard.
        await editorPage.selectBlock(0);
        await editorPage.duplicateSelectedBlock();
        expect(await editorPage.getBlockCount()).toBe(blocksAtStart + 2);

        const [only] = await readVersions(page);
        await page.locator(SELECTORS.versionHistoryToggle).click();
        await page.locator(`[data-version-id="${only.id}"]`).click();
        await expect(
          page.locator(SELECTORS.versionPreviewBanner),
        ).toBeVisible();

        await page.locator(SELECTORS.versionPreviewRestore).click();
        await expect(
          page.locator(SELECTORS.restoreVersionDialog),
        ).toBeVisible();

        await page.locator(SELECTORS.restoreVersionSaveFirst).click();

        await expect(page.locator(SELECTORS.restoreVersionDialog)).toBeHidden();
        await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeHidden();
        // Three entries: the first save, the work saved on the way out, and the
        // append-only restore. The middle one is the whole point — the two-block
        // state the user would otherwise have lost is now reachable again.
        await expect
          .poll(async () => (await readVersions(page)).length)
          .toBe(3);
        const [, saved] = await readVersions(page);
        expect(saved.content.blocks.length).toBe(storedAtStart + 2);
        await expect
          .poll(() => editorPage.getBlockCount())
          .toBe(blocksAtStart + 1);
      });

      test("Restore anyway discards the unsaved work", async ({
        editorPage,
      }) => {
        const page = editorPage.page;

        const blocksAtStart = await editorPage.getBlockCount();
        await editAndSave(page, editorPage, 1);
        await editorPage.selectBlock(0);
        await editorPage.duplicateSelectedBlock();

        const [only] = await readVersions(page);
        await page.locator(SELECTORS.versionHistoryToggle).click();
        await page.locator(`[data-version-id="${only.id}"]`).click();
        await page.locator(SELECTORS.versionPreviewRestore).click();
        await expect(
          page.locator(SELECTORS.restoreVersionDialog),
        ).toBeVisible();

        await page.locator(SELECTORS.restoreVersionDiscard).click();

        await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeHidden();
        // Only the restore was appended — nothing was written for the discarded
        // edit, which is exactly what "discard" has to mean.
        await expect
          .poll(async () => (await readVersions(page)).length)
          .toBe(2);
        await expect
          .poll(() => editorPage.getBlockCount())
          .toBe(blocksAtStart + 1);
      });

      test("Cancel leaves the preview up and restores nothing", async ({
        editorPage,
      }) => {
        const page = editorPage.page;

        const blocksAtStart = await editorPage.getBlockCount();
        await editAndSave(page, editorPage, 1);
        await editorPage.selectBlock(0);
        await editorPage.duplicateSelectedBlock();

        const [only] = await readVersions(page);
        await page.locator(SELECTORS.versionHistoryToggle).click();
        await page.locator(`[data-version-id="${only.id}"]`).click();
        await page.locator(SELECTORS.versionPreviewRestore).click();
        await page.locator(SELECTORS.restoreVersionCancel).click();

        await expect(page.locator(SELECTORS.restoreVersionDialog)).toBeHidden();
        await expect(
          page.locator(SELECTORS.versionPreviewBanner),
        ).toBeVisible();
        expect((await readVersions(page)).length).toBe(1);

        // Leaving the preview still puts the unsaved work back untouched.
        await page.locator(SELECTORS.versionPreviewCancel).click();
        await expect
          .poll(() => editorPage.getBlockCount())
          .toBe(blocksAtStart + 2);
      });
    });
  });

  test.describe("read-only history", () => {
    /**
     * `restore: false`: browsing and previewing keep working — the store has
     * simply stated that nothing may be made current again. The action is hidden
     * rather than disabled, the same discipline saved blocks uses.
     */
    test("hides Restore but keeps preview and cancel working", async ({
      page,
      shadowDom,
      editorPage,
    }) => {
      await openVersionHistoryScene(page, shadowDom, editorPage, {
        readonly: "1",
      });

      const blocksAtStart = await editorPage.getBlockCount();
      await editAndSave(page, editorPage, 1);
      // A second, unsaved edit, so the preview is visibly a different state and
      // Cancel has something to put back.
      await editorPage.selectBlock(0);
      await editorPage.duplicateSelectedBlock();
      expect(await editorPage.getBlockCount()).toBe(blocksAtStart + 2);

      const [only] = await readVersions(page);
      await page.locator(SELECTORS.versionHistoryToggle).click();
      await page.locator(`[data-version-id="${only.id}"]`).click();

      await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeVisible();
      await expect(page.locator(SELECTORS.versionPreviewRestore)).toHaveCount(
        0,
      );
      await expect
        .poll(() => editorPage.getBlockCount())
        .toBe(blocksAtStart + 1);

      await page.locator(SELECTORS.versionPreviewCancel).click();
      await expect(page.locator(SELECTORS.versionPreviewBanner)).toBeHidden();
      await expect
        .poll(() => editorPage.getBlockCount())
        .toBe(blocksAtStart + 2);
    });
  });
});
