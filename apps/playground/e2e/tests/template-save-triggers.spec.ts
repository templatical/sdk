import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Proves the distinction `TemplatesOptions.onSaved` exists for: a header-button
 * save reports its trigger as "manual", and a debounced autosave tick reports
 * "autosave" — never the other way round.
 *
 * Reads `window.__tplPlaygroundSaveTriggers`, an array the playground's demo
 * templates provider (`templatesProviderFor` in `apps/playground/src/App.vue`)
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

/**
 * Storage flags are set through `addInitScript` because the templates
 * provider reads them while the editor mounts — writing them after `goto()`
 * races the initial load. Mirrors `templates.spec.ts`'s `openEditor` helper.
 */
async function openEditor(
  page: Page,
  fixtures: {
    chooserPage: {
      goto: () => Promise<void>;
      selectFirstTemplate: () => Promise<void>;
    };
    editorPage: {
      waitForReady: () => Promise<void>;
      dismissOverlays: () => Promise<void>;
    };
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

test.describe("save triggers", () => {
  // The demo templates provider is writable by default (the read-only flag
  // is opt-in), so `editorReady` alone is enough to reach a save — no
  // `addInitScript` needed here.
  test("the header button reports manual", async ({ page, editorReady }) => {
    await page.locator(SELECTORS.templateSave).click();

    await expect.poll(() => read(page)).toContain("manual");
    expect(await read(page)).not.toContain("autosave");
  });

  test("an autosave tick reports autosave", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    // Autosave defaults off in the playground (a demo that saves by itself
    // would hide what the Save button does) — opt in via its storage flag,
    // set before navigation so `initEditor()` reads it on first mount.
    await openEditor(
      page,
      { chooserPage, editorPage },
      {
        "tpl-playground-templates-autosave": "true",
      },
    );

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
