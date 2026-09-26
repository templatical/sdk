import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { ScenePage } from "../pages/scene.page";

/**
 * Proves the distinction `TemplatesOptions.onSaved` exists for: a header-button
 * save reports its trigger as "manual", and a debounced autosave tick reports
 * "autosave" — never the other way round.
 *
 * Reads `window.__tplPlaygroundSaveTriggers`, an array the playground's demo
 * templates provider (`templatesProviderFor` in `apps/playground/src/host/providers.ts`)
 * appends to from its `onSaved` hook. Recorded on `window` rather than
 * rendered, since a visible trigger log would be test-only UI in front of
 * every visitor.
 */
const read = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __tplPlaygroundSaveTriggers?: string[] })
        .__tplPlaygroundSaveTriggers ?? [],
  );

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

test.describe("save triggers", () => {
  test.describe("manual save via templates scene", () => {
    test("the header button reports manual", async ({
      page,
      shadowDom,
      editorPage,
    }) => {
      await openTemplatesScene(page, shadowDom, editorPage);
      await page.locator(SELECTORS.templateSave).click();

      await expect.poll(() => read(page)).toContain("manual");
      expect(await read(page)).not.toContain("autosave");
    });
  });

  test("an autosave tick reports autosave", async ({
    page,
    shadowDom,
    editorPage,
  }) => {
    await openTemplatesScene(page, shadowDom, editorPage, { autosave: "1" });

    await editorPage.doubleClickBlock("paragraph");
    const editable = editorPage.getEditableFor("paragraph");
    await editable.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("edited");

    // Autosave is a 2000ms trailing debounce; poll rather than sleep.
    await expect
      .poll(() => read(page), { timeout: 15_000 })
      .toContain("autosave");
    expect(await read(page)).not.toContain("manual");
  });
});
