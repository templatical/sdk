import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * The BYO templates provider in the OSS editor, backed by the playground's
 * localStorage store (`templatesProviderFor` in `apps/playground/src/App.vue`).
 *
 * The playground attaches a template right after `init()` — `create()` on a
 * fresh chooser open — so the header's name field, status indicator and Save
 * button are all live on every run. What the playground can express bounds this
 * spec: the read-only branch is reachable through a storage flag, and the
 * remaining branches (no provider at all, a rejected save, autosave timing) stay
 * in `useTemplatesFeature.test.ts` / `editor-templates.test.ts`.
 */

// `selectFirstTemplate()` opens Product Launch, so that's the record under test.
const STORE_KEY = "templatical:template:product-launch";

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

/**
 * Storage flags are set through `addInitScript` because the provider is built
 * during the editor's mount — writing them after `goto()` races the initial load.
 */
async function openEditor(
  page: Page,
  fixtures: {
    chooserPage: { goto: () => Promise<void>; selectFirstTemplate: () => Promise<void> };
    editorPage: { waitForReady: () => Promise<void>; dismissOverlays: () => Promise<void> };
  },
  flags: Record<string, string> = {},
): Promise<void> {
  await page.addInitScript((entries) => {
    localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
    localStorage.setItem("tpl-playground-features-dismissed", "true");
    for (const [key, value] of entries as [string, string][]) {
      localStorage.setItem(key, value);
    }
  }, Object.entries(flags));
  await fixtures.chooserPage.goto();
  await fixtures.chooserPage.selectFirstTemplate();
  await fixtures.editorPage.waitForReady();
  await fixtures.editorPage.dismissOverlays();
}

test.describe("templates provider", () => {
  test("the header shows the attached template's name and a save button", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await expect(page.locator(SELECTORS.templateName)).toHaveText(
      "Product Launch",
    );
    await expect(page.locator(SELECTORS.templateSave)).toBeVisible();
    await expect(page.locator(SELECTORS.templateSave)).toBeEnabled();
  });

  test("create() stored the chosen template on first open", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;

    const stored = await readStored(editorPage.page);
    expect(stored?.id).toBe("product-launch");
    expect(stored?.name).toBe("Product Launch");
    expect(stored?.content.blocks.length).toBeGreaterThan(0);
  });

  test("no status badge is shown while nothing is unsaved", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await expect(page.locator(SELECTORS.saveStatusUnsaved)).toHaveCount(0);
    await expect(page.locator(SELECTORS.saveStatusError)).toHaveCount(0);
  });

  test("an edit shows Unsaved, and Save persists it and confirms", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
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
    editorReady,
  }) => {
    const { editorPage } = editorReady;
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
      editorReady,
    }) => {
      const { editorPage } = editorReady;
      const page = editorPage.page;

      await page.locator(SELECTORS.templateName).click();
      const input = page.locator(SELECTORS.templateNameInput);
      await expect(input).toBeVisible();
      await expect(input).toHaveValue("Product Launch");

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
      editorReady,
    }) => {
      const { editorPage } = editorReady;
      const page = editorPage.page;

      await page.locator(SELECTORS.templateName).click();
      const input = page.locator(SELECTORS.templateNameInput);
      await input.fill("Discarded");
      await input.press("Escape");

      await expect(page.locator(SELECTORS.templateName)).toHaveText(
        "Product Launch",
      );
      expect((await readStored(page))!.name).toBe("Product Launch");
    });

    test("an emptied name reverts instead of clearing the title", async ({
      editorReady,
    }) => {
      const { editorPage } = editorReady;
      const page = editorPage.page;

      await page.locator(SELECTORS.templateName).click();
      const input = page.locator(SELECTORS.templateNameInput);
      await input.fill("");
      await input.press("Enter");

      await expect(page.locator(SELECTORS.templateName)).toHaveText(
        "Product Launch",
      );
      expect((await readStored(page))!.name).toBe("Product Launch");
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
      chooserPage,
      editorPage,
    }) => {
      await openEditor(page, { chooserPage, editorPage }, {
        "tpl-playground-templates-readonly": "true",
      });

      await expect(page.locator(SELECTORS.templateSave)).toHaveCount(0);
      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toHaveCount(0);

      await editorPage.selectBlock(0);
      await editorPage.duplicateSelectedBlock();

      // Still nothing to show: an unsavable editor has no save state to report.
      await expect(page.locator(SELECTORS.saveStatusUnsaved)).toHaveCount(0);
      await expect(page.locator(SELECTORS.templateSave)).toHaveCount(0);
    });

    test("keeps editing working", async ({
      page,
      chooserPage,
      editorPage,
    }) => {
      await openEditor(page, { chooserPage, editorPage }, {
        "tpl-playground-templates-readonly": "true",
      });

      const before = await editorPage.getBlockCount();
      await editorPage.selectBlock(0);
      await editorPage.duplicateSelectedBlock();

      await expect.poll(() => editorPage.getBlockCount()).toBe(before + 1);
    });
  });
});
