import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { EditorPage } from "../pages/editor.page";

/**
 * Text whose size, line height or letter spacing the presets don't offer
 * (imported or pasted content): each paragraph toolbar select shows the value
 * in use instead of its placeholder, and the extra option goes once a preset
 * is chosen.
 */

const CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Arial",
    locale: "en",
  },
  blocks: [
    {
      id: "imported-paragraph",
      type: "paragraph",
      content:
        '<p style="line-height: 1.3"><span style="font-size: 15px; letter-spacing: 0.8px">Imported text</span></p>',
      styles: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
    },
  ],
};

async function openWithContent(
  page: Page,
  editorPage: EditorPage,
  shadowDom: boolean,
) {
  await page.route("**/api/shares/unlisted-values", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "unlisted-values",
        sceneId: "minimum",
        content: CONTENT,
        createdAt: "2026-10-13T00:00:00.000Z",
      }),
    });
  });
  await page.goto(`/?s=unlisted-values&shadowDom=${shadowDom ? "1" : "0"}`);
  await page.waitForSelector(
    '[data-testid="scene-host"][data-scene-ready="true"]',
  );
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
}

const selectedLabel = (select: Locator) =>
  select.evaluate((el: HTMLSelectElement) =>
    el.options[el.selectedIndex]?.text.trim(),
  );

const optionLabels = (select: Locator) =>
  select.evaluate((el: HTMLSelectElement) =>
    Array.from(el.options, (option) => option.text.trim()),
  );

test.describe("paragraph toolbar with unlisted values", () => {
  for (const [name, shown, preset] of [
    ["Font Size", "15px", "16px"],
    ["Line Height", "1.3", "1.5"],
    ["Letter Spacing", "0.8px", "1px"],
  ] as const) {
    test(`${name} shows ${shown} until a preset is chosen`, async ({
      editorPage,
      page,
      shadowDom,
    }) => {
      await openWithContent(page, editorPage, shadowDom);
      await page.locator('[data-block-id="imported-paragraph"]').dblclick();
      await page.keyboard.press("ControlOrMeta+a");

      const select = page
        .locator(SELECTORS.textToolbar)
        .getByRole("combobox", { name });
      await expect.poll(() => selectedLabel(select)).toBe(shown);

      await select.selectOption(preset);
      await expect.poll(() => selectedLabel(select)).toBe(preset);
      await expect.poll(() => optionLabels(select)).not.toContain(shown);
    });
  }
});
