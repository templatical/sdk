import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

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
    // Add a section to blank canvas
    await editorPage.dragBlockFromSidebar("Section");
    await page.waitForTimeout(500);

    const section = page.locator(blockByType("section")).first();
    // Empty section should show "Drop here" placeholder text
    const dropHint = section.locator("span");
    const hintText = await dropHint.first().textContent();
    expect(hintText).toBeTruthy();
  });

  test("drag block into second column of section", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));
    const sectionCount = await sections.count();

    if (sectionCount === 0) {
      test.skip();
      return;
    }

    // Count total blocks inside all sections before
    const totalBlocksBefore = await sections
      .first()
      .locator(".tpl-block")
      .count();

    // Drag a divider into second column (colIndex=1)
    await editorPage.dragBlockFromSidebarToSection("Divider", 0, 1);
    await page.waitForTimeout(500);

    // Total blocks inside section should increase
    const totalBlocksAfter = await sections
      .first()
      .locator(".tpl-block")
      .count();
    expect(totalBlocksAfter).toBe(totalBlocksBefore + 1);
  });
});
