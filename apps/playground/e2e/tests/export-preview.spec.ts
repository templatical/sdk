import { join } from "node:path";
import type { Locator } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { readBuildInfo } from "../../scripts/build-info";

// The dev server bakes in the same values, from the same repo and env.
const BUILD = readBuildInfo(join(import.meta.dirname, "../../../.."));

test.describe("Export preview", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.closeCodeDrawer();
  });

  test("opens on Preview and renders the compiled email in the frame", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportTabPreview)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const frame = page.locator(SELECTORS.exportPreviewFrame);
    await expect(frame).toHaveAttribute("srcdoc", /^<!doctype html>/i);
    await expect(
      page
        .frameLocator(SELECTORS.exportPreviewFrame)
        .getByText("Introducing Launchpad v2.0", { exact: true }),
    ).toBeVisible();
  });

  test("the frame is sandboxed without scripts or the playground's origin", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    const sandbox = await page
      .locator(SELECTORS.exportPreviewFrame)
      .getAttribute("sandbox");
    expect(sandbox?.split(/\s+/).sort()).toEqual([
      "allow-popups",
      "allow-popups-to-escape-sandbox",
    ]);
  });

  test("Mobile narrows the frame below MJML's breakpoint", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    const frame = page.locator(SELECTORS.exportPreviewFrame);
    const viewportWidth = () =>
      page
        .frameLocator(SELECTORS.exportPreviewFrame)
        .locator("body")
        .evaluate(() => window.innerWidth);

    await expect(
      page.locator(SELECTORS.exportPreviewDesktop).getByRole("radio"),
    ).toBeChecked();
    expect(await viewportWidth()).toBeGreaterThan(480);

    await page.locator(SELECTORS.exportPreviewMobile).click();
    await expect(
      page.locator(SELECTORS.exportPreviewMobile).getByRole("radio"),
    ).toBeChecked();
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(375);
    await expect.poll(viewportWidth).toBe(375);
  });

  test("reopening starts on Preview at desktop width", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportPreviewMobile).click();
    await page.locator(SELECTORS.exportTabMjml).click();
    await page.locator(SELECTORS.exportModalClose).click();
    await expect(page.locator(SELECTORS.exportModal)).toHaveCount(0);

    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportTabPreview)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.locator(SELECTORS.exportPreviewDesktop).getByRole("radio"),
    ).toBeChecked();
  });

  test("Copy on Preview copies the HTML the frame renders", async ({
    editorPage,
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await editorPage.openExport();
    const frame = page.locator(SELECTORS.exportPreviewFrame);
    await expect(frame).toHaveAttribute("srcdoc", /^<!doctype html>/i);
    const srcdoc = await frame.getAttribute("srcdoc");

    await page.locator(SELECTORS.exportCopyBtn).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      srcdoc,
    );
  });

  test("Download on Preview saves the HTML", async ({ editorPage, page }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportDownloadBtn)).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportDownloadBtn).click(),
    ]);
    expect(download.suggestedFilename()).toBe("email-template.html");
  });
});

test.describe("Build info", () => {
  async function expectBuildInfo(scope: Locator): Promise<void> {
    const info = scope.locator(SELECTORS.buildInfo);
    await expect(info).toContainText(`SDK ${BUILD.version}`);
    const link = scope.locator(SELECTORS.buildInfoCommit);
    if (BUILD.commit) {
      await expect(link).toHaveText(BUILD.commit.slice(0, 7));
      await expect(link).toHaveAttribute(
        "href",
        `https://github.com/templatical/sdk/compare/v${BUILD.version}...${BUILD.commit}`,
      );
    } else {
      await expect(link).toHaveCount(0);
    }
  }

  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.closeCodeDrawer();
  });

  test("shows in the Export dialog", async ({ editorPage, page }) => {
    await editorPage.openExport();
    await expectBuildInfo(page.locator(SELECTORS.exportModal));
  });

  test("shows in the settings menu", async ({ page }) => {
    await page.locator(SELECTORS.hostSettings).click();
    await expectBuildInfo(page.locator(SELECTORS.hostSettingsPanel));
  });
});
