import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

/**
 * The layout overlay contract, driven through the Layout scene: the editing
 * canvas and getContent() hold only the authored email, while preview and
 * export compose the shell around it. The shell's text and URLs appear
 * nowhere in the authored setup email, so every negative check below can
 * only pass because the shell was left out.
 */

/** Export's Download writes the whole file; the code view renders only the
 * lines in its viewport, so a missing-text check against it proves nothing. */
async function downloadExport(page: Page): Promise<string> {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(SELECTORS.exportDownloadBtn).click(),
  ]);
  return readFile((await file.path())!, "utf8");
}

test.describe("Layout scene", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("layout");
    await editorPage.waitForReady();
  });

  test("the editing canvas holds only the authored email", async ({ page }) => {
    await expect(page.locator(SELECTORS.block).first()).toBeVisible();
    await expect(page.getByText("View in browser")).toHaveCount(0);
  });

  test("preview wraps the email in the shell", async ({ editorPage, page }) => {
    await editorPage.togglePreview();
    await expect(page.getByText("View in browser")).toBeVisible();
    await expect(page.getByText("Imprint", { exact: true })).toBeVisible();
    await editorPage.togglePreview();
    await expect(page.getByText("View in browser")).toHaveCount(0);
  });

  test("export composes the shell and the JSON stays authored", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportTabMjml)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const mjml = await downloadExport(page);
    expect(mjml).toContain("https://example.com/view");
    expect(mjml).toContain("https://example.com/imprint");

    await page.locator(SELECTORS.exportTabJson).click();
    await expect(page.locator(SELECTORS.exportTabJson)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const json = await downloadExport(page);
    expect(JSON.parse(json).blocks.length).toBeGreaterThan(0);
    expect(json).not.toContain("https://example.com/view");
    expect(json).not.toContain("https://example.com/imprint");
  });

  test("sections offer no Add wrapper", async ({
    editorPage,
    page,
    scenePage,
  }) => {
    const addWrapper = page.getByRole("switch", { name: "Add wrapper" });
    // A click at a section's centre lands on a child block, so dispatch it on
    // the section itself; the section-only switch proves what got selected.
    const selectFirstSection = async () => {
      await page.locator(blockByType("section")).first().dispatchEvent("click");
      await page.locator(SELECTORS.blockToolbar).waitFor();
      await expect(
        page.getByRole("switch", { name: "Stack on mobile" }),
      ).toBeVisible();
    };

    await selectFirstSection();
    await expect(addWrapper).toHaveCount(0);

    // Control: the same email without sectionWrapper: false shows it.
    await scenePage.goto("fonts");
    await editorPage.waitForReady();
    await selectFirstSection();
    await expect(addWrapper).toHaveCount(1);
  });
});
