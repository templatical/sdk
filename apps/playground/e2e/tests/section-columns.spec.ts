import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";
import type { EditorPage } from "../pages/editor.page";

const PADDING = { padding: { top: 10, right: 10, bottom: 10, left: 10 } };

/** A one-column section whose only block carries a display condition. */
const CONDITIONAL_COLUMN = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Arial",
    locale: "en",
  },
  blocks: [
    {
      id: "section",
      type: "section",
      columns: "1",
      styles: PADDING,
      children: [
        [
          {
            id: "vip-note",
            type: "paragraph",
            content: "<p>VIP only</p>",
            styles: PADDING,
            displayCondition: {
              label: "VIP Partners",
              before: "{% if vip %}",
              after: "{% endif %}",
            },
          },
        ],
      ],
    },
  ],
};

async function openWithContent(
  page: Page,
  editorPage: EditorPage,
  shadowDom: boolean,
) {
  await page.route("**/api/shares/conditional-column", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "conditional-column",
        sceneId: "minimum",
        content: CONDITIONAL_COLUMN,
        createdAt: "2026-10-15T00:00:00.000Z",
      }),
    }),
  );
  await page.goto(`/?s=conditional-column&shadowDom=${shadowDom ? "1" : "0"}`);
  await page.waitForSelector(
    '[data-testid="scene-host"][data-scene-ready="true"]',
  );
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
}

const heightOf = async (el: Locator) => (await el.boundingBox())!.height;
const borderOf = (el: Locator) =>
  el.evaluate((node) => {
    const { borderTopWidth, borderTopStyle } = getComputedStyle(node);
    return `${borderTopWidth} ${borderTopStyle}`;
  });

test.describe("Section columns", () => {
  test("section block renders with columns", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));
    const count = await sections.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // First section should have column containers
    const firstSection = sections.first();
    // Columns are direct children of the flex container
    const flexContainer = firstSection.locator(
      'div[class*="tpl:flex"][class*="tpl:gap-0"]',
    );
    await expect(flexContainer).toBeVisible();

    const columns = flexContainer.locator("> div");
    expect(await columns.count()).toBeGreaterThanOrEqual(2);
  });

  test("section columns have correct width ratios", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));

    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    const firstSection = sections.first();
    const flexContainer = firstSection.locator(
      'div[class*="tpl:flex"][class*="tpl:gap-0"]',
    );
    const columns = flexContainer.locator("> div");
    const colCount = await columns.count();

    // Each column should have a width style
    for (let i = 0; i < colCount; i++) {
      const style = await columns.nth(i).getAttribute("style");
      expect(style).toContain("width:");
    }
  });

  test("section columns contain child blocks", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));

    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    // Product Launch template sections have child blocks
    const firstSection = sections.first();
    const childBlocks = firstSection.locator(".tpl-block");
    expect(await childBlocks.count()).toBeGreaterThan(0);
  });

  test("empty section column shows drop hint", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await editorPage.dragBlockFromSidebar("section");

    const section = page.locator(blockByType("section")).first();
    const dropHint = section.locator('[data-testid="section-drop-hint"]').first();
    await expect(dropHint).toBeVisible();
    const hintText = (await dropHint.textContent())?.trim() ?? "";
    expect(hintText.length).toBeGreaterThan(0);
  });

  test("empty section column drops its chrome in preview", async ({
    blankEditorReady: { editorPage },
  }) => {
    await editorPage.dragBlockFromSidebar("section");

    const column = editorPage.getSectionColumn(0, 0);
    const dropHint = column.locator('[data-testid="section-drop-hint"]');

    // The 60px drop height inside a 1px dashed border.
    await expect(dropHint).toBeVisible();
    await expect.poll(() => heightOf(column)).toBe(62);
    expect(await borderOf(column)).toBe("1px dashed");

    await editorPage.togglePreview();

    // The email fills an empty column with a one-line placeholder, 34px tall.
    await expect(dropHint).toHaveCount(0);
    await expect.poll(() => heightOf(column)).toBe(34);
    // Preflight's `border: 0 solid` is what's left once the class goes.
    expect(await borderOf(column)).toBe("0px solid");

    await editorPage.togglePreview();

    await expect(dropHint).toBeVisible();
    await expect.poll(() => heightOf(column)).toBe(62);
    expect(await borderOf(column)).toBe("1px dashed");
  });

  test("a column whose blocks the condition filter hides collapses in preview", async ({
    editorPage,
    page,
    shadowDom,
  }) => {
    await openWithContent(page, editorPage, shadowDom);

    const column = editorPage.getSectionColumn(0, 0);
    const block = page.locator('[data-block-id="vip-note"]');
    await block.locator(SELECTORS.conditionToggle).click();
    await expect(block).toBeHidden();

    // Editing keeps the drop height, so the column still takes drops.
    await expect.poll(() => heightOf(column)).toBe(60);

    await editorPage.togglePreview();

    // With the condition false, the email's column holds only its raw tags.
    await expect.poll(() => heightOf(column)).toBe(0);
    await expect(
      column.locator('[data-testid="section-drop-hint"]'),
    ).toHaveCount(0);
  });

  test("drag block into second column of section", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Sidebar→section column drop. `dragBlockFromSidebarToSection` now
    // drives the mouse manually (Sortable runs in force-fallback mode
    // which doesn't respond to Playwright's HTML5 `dragTo` — manual
    // pointer drive is the supported pattern).
    const sections = page.locator(blockByType("section"));
    const sectionCount = await sections.count();

    if (sectionCount === 0) {
      test.skip();
      return;
    }

    const totalBlocksBefore = await sections
      .first()
      .locator(".tpl-block")
      .count();

    await editorPage.dragBlockFromSidebarToSection("divider", 0, 1);

    expect(
      await sections.first().locator(".tpl-block").count(),
    ).toBe(totalBlocksBefore + 1);
  });
});
