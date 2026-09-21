import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { ScenePage } from "../pages/scene.page";

/**
 * The BYO templates provider in the OSS editor, backed by the playground's
 * localStorage store (`templatesProviderFor` in `apps/playground/src/host/providers.ts`).
 *
 * The playground attaches a template right after `init()` — `create()` on a
 * fresh chooser open — so the header's name field, status indicator and Save
 * button are all live on every run. What the playground can express bounds this
 * spec: the read-only branch is reachable through a storage flag, and the
 * remaining branches (no provider at all, a rejected save, autosave timing) stay
 * in `useTemplatesFeature.test.ts` / `editor-templates.test.ts`.
 */

const STORE_KEY = "templatical:template:templates";

type StoredTemplate = {
  id: string;
  name?: string;
  content: { blocks: unknown[] };
};

async function readStored(page: Page): Promise<StoredTemplate | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredTemplate) : null;
  }, STORE_KEY);
}

async function openTemplatesScene(
  page: Page,
  shadowDom: boolean,
  editorPage: {
    waitForReady: () => Promise<void>;
    dismissOverlays: () => Promise<void>;
  },
  query: Record<string, string> = {},
): Promise<void> {
  await new ScenePage(page, { shadowDom }).goto("templates", query);
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
}

test.describe("templates provider", () => {
  test.describe("templates scene", () => {
    test.beforeEach(async ({ page, shadowDom, editorPage }) => {
      await openTemplatesScene(page, shadowDom, editorPage);
    });

    test("the header shows the attached template's name and a save button", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      await expect(page.locator(SELECTORS.templateName)).toHaveText(
        "Templates",
      );
      await expect(page.locator(SELECTORS.templateSave)).toBeVisible();
      await expect(page.locator(SELECTORS.templateSave)).toBeEnabled();
    });

    test("create() stored the chosen template on first open", async ({
      editorPage,
    }) => {
      const stored = await readStored(editorPage.page);
      expect(stored?.id).toBe("templates");
      expect(stored?.name).toBe("Templates");
      expect(stored?.content.blocks.length).toBeGreaterThan(0);
    });

    test("no status badge is shown while nothing is unsaved", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toHaveCount(0);
      await expect(page.locator(SELECTORS.saveStatusError)).toHaveCount(0);
    });

    test("an edit shows Unsaved, and Save persists it and confirms", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      const before = await readStored(page);
      const blocksBefore = before!.content.blocks.length;

      await editorPage.selectBlock(0);
      await editorPage.duplicateSelectedBlock();
      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toBeVisible();

      await page.locator(SELECTORS.templateSave).click();

      await expect(page.locator(SELECTORS.saveStatusSaved)).toBeVisible();
      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toHaveCount(0);
      await expect
        .poll(async () => (await readStored(page))!.content.blocks.length)
        .toBe(blocksBefore + 1);
    });

    test("Cmd+S persists without touching the button", async ({
      editorPage,
    }) => {
      const page = editorPage.page;

      const blocksBefore = (await readStored(page))!.content.blocks.length;

      await editorPage.selectBlock(0);
      await editorPage.duplicateSelectedBlock();
      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toBeVisible();

      await page.keyboard.press("ControlOrMeta+s");

      await expect(page.locator(SELECTORS.saveStatusSaved)).toBeVisible();
      await expect
        .poll(async () => (await readStored(page))!.content.blocks.length)
        .toBe(blocksBefore + 1);
    });

    test.describe("inline rename", () => {
      test("commits on Enter and persists through the save patch", async ({
        editorPage,
      }) => {
        const page = editorPage.page;

        await page.locator(SELECTORS.templateName).click();
        const input = page.locator(SELECTORS.templateNameInput);
        await expect(input).toBeVisible();
        await expect(input).toHaveValue("Templates");

        await input.fill("Spring Campaign");
        await input.press("Enter");

        await expect(page.locator(SELECTORS.templateName)).toHaveText(
          "Spring Campaign",
        );
        await expect
          .poll(async () => (await readStored(page))!.name)
          .toBe("Spring Campaign");
      });

      test("Escape discards the draft and stores nothing", async ({
        editorPage,
      }) => {
        const page = editorPage.page;

        await page.locator(SELECTORS.templateName).click();
        const input = page.locator(SELECTORS.templateNameInput);
        await input.fill("Discarded");
        await input.press("Escape");

        await expect(page.locator(SELECTORS.templateName)).toHaveText(
          "Templates",
        );
        expect((await readStored(page))!.name).toBe("Templates");
      });

      test("an emptied name reverts instead of clearing the title", async ({
        editorPage,
      }) => {
        const page = editorPage.page;

        await page.locator(SELECTORS.templateName).click();
        const input = page.locator(SELECTORS.templateNameInput);
        await input.fill("");
        await input.press("Enter");

        await expect(page.locator(SELECTORS.templateName)).toHaveText(
          "Templates",
        );
        expect((await readStored(page))!.name).toBe("Templates");
      });
    });
  });

  test.describe("read-only store", () => {
    /**
     * `save: false` / `create: false`: the whole point is that disabling is a
     * decision the store states. Editing still works — there is simply nowhere
     * for it to go — so the save button, the status indicator and the rename
     * affordance all disappear rather than sitting there doing nothing.
     */
    test("hides the save button and the status indicator", async ({
      page,
      shadowDom,
      editorPage,
    }) => {
      await openTemplatesScene(page, shadowDom, editorPage, {
        readonly: "1",
      });

      await expect(page.locator(SELECTORS.templateSave)).toHaveCount(0);
      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toHaveCount(0);

      await editorPage.selectBlock(0);
      await editorPage.duplicateSelectedBlock();

      // Still nothing to show: an unsavable editor has no save state to report.
      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toHaveCount(0);
      await expect(page.locator(SELECTORS.templateSave)).toHaveCount(0);
    });

    test("keeps editing working", async ({ page, shadowDom, editorPage }) => {
      await openTemplatesScene(page, shadowDom, editorPage, {
        readonly: "1",
      });

      const before = await editorPage.getBlockCount();
      await editorPage.selectBlock(0);
      await editorPage.duplicateSelectedBlock();

      await expect.poll(() => editorPage.getBlockCount()).toBe(before + 1);
    });
  });
});
