import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const beefreeJson = readFileSync(
  join(fixturesDir, "beefree-template.json"),
  "utf8",
);
const unlayerJson = readFileSync(
  join(fixturesDir, "unlayer-template.json"),
  "utf8",
);

test.describe("Template import", () => {
  test.beforeEach(async ({ page }) => {
    // Suppress overlays so the editor screen reaches a stable state after import.
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
  });

  test("imports a BeeFree template and renders converted blocks", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.importTemplate("beefree", beefreeJson);

    // Modal closes
    await expect(page.locator(SELECTORS.importModal)).toHaveCount(0);

    // Editor mounts with imported content
    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.editorScreen)).toBeVisible();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from BeeFree");

    const paragraphBlock = page.locator(blockByType("paragraph")).first();
    await expect(paragraphBlock).toContainText("BeeFree e2e fixture");

    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("imports an Unlayer template and renders converted blocks", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.importTemplate("unlayer", unlayerJson);

    await expect(page.locator(SELECTORS.importModal)).toHaveCount(0);

    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.editorScreen)).toBeVisible();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from Unlayer");

    const paragraphBlock = page.locator(blockByType("paragraph")).first();
    await expect(paragraphBlock).toContainText("Unlayer e2e fixture");

    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("migration band advertises both sources on the chooser", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();

    const band = chooserPage.getMigrationBand();
    await expect(band).toBeVisible();
    await expect(band).toContainText(/BeeFree/);
    await expect(band).toContainText(/Unlayer/);
    await expect(page.locator(SELECTORS.chooserImportBeefree)).toBeVisible();
    await expect(page.locator(SELECTORS.chooserImportUnlayer)).toBeVisible();
  });

  test("BeeFree CTA opens modal with BeeFree tab selected", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.openImportModal("beefree");

    await expect(page.locator(SELECTORS.importTabBeefree)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator(SELECTORS.importTabUnlayer)).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaUnlayer)).toHaveCount(0);
  });

  test("Unlayer CTA opens modal with Unlayer tab selected", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.openImportModal("unlayer");

    await expect(page.locator(SELECTORS.importTabUnlayer)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator(SELECTORS.importTabBeefree)).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.locator(SELECTORS.importTextareaUnlayer)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("switching to Unlayer tab swaps the textarea and preserves BeeFree input", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.openImportModal();

    const beefreeText = '{"page":{"rows":[]}}';
    await chooserPage.pasteImportJson("beefree", beefreeText);
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveValue(
      beefreeText,
    );

    await chooserPage.selectImportSource("unlayer");
    await expect(page.locator(SELECTORS.importTextareaUnlayer)).toBeVisible();
    await expect(
      page.locator(SELECTORS.importTextareaBeefree),
    ).toHaveCount(0);
    await expect(page.locator(SELECTORS.importTextareaUnlayer)).toHaveValue("");

    // Flip back — BeeFree input should still be there.
    await chooserPage.selectImportSource("beefree");
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveValue(
      beefreeText,
    );
  });

  test("shows an error when the BeeFree JSON is invalid", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.openImportModal();
    await chooserPage.selectImportSource("beefree");
    await chooserPage.pasteImportJson("beefree", "{ not json");
    await chooserPage.confirmImport();

    const error = chooserPage.getImportError();
    await expect(error).toBeVisible();
    const errorText = await error.innerText();
    expect(errorText.length).toBeGreaterThan(0);
    // Modal stays open
    await expect(page.locator(SELECTORS.importModal)).toBeVisible();
  });

  test("shows an error when the Unlayer JSON is invalid", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.openImportModal();
    await chooserPage.selectImportSource("unlayer");
    await chooserPage.pasteImportJson("unlayer", '{"body":{}}');
    await chooserPage.confirmImport();

    const error = chooserPage.getImportError();
    await expect(error).toBeVisible();
    await expect(error).toContainText(/body|rows/i);
    await expect(page.locator(SELECTORS.importModal)).toBeVisible();
  });

  test("shows an empty-input error and stays on the chooser when nothing is pasted", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.openImportModal();
    await chooserPage.confirmImport();

    await expect(chooserPage.getImportError()).toBeVisible();
    await expect(page.locator(SELECTORS.importModal)).toBeVisible();
    await expect(page.locator(SELECTORS.editorScreen)).toHaveCount(0);
  });
});
