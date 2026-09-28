import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import { test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Below the editor's own small-screen breakpoint the scene shows its setup
 * as a card, and no editor mounts: the editor would only cover itself with
 * its "needs a larger screen" notice.
 */
const PROOFS: Record<string, { src: string }> = JSON.parse(
  readFileSync(new URL("../../src/host/proof-manifest.json", import.meta.url), "utf8"),
);

test.describe("Phone setup card", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("a setup opens as a card, with no editor behind it", async ({
    page,
    scenePage,
  }) => {
    await scenePage.goto("fonts");
    const card = page.locator(SELECTORS.setupCard);
    await expect(card.locator("h1")).toHaveText("Fonts");
    await expect(card.getByTestId("scene-init-key")).toHaveText("fonts");
    await expect(page.getByTestId("setup-card-see-it")).toContainText("Georgia");
    await expect(page.locator(SELECTORS.setupCardSnippet)).toContainText(
      "builtIns",
    );
    await expect(page.locator(SELECTORS.setupCardDocs)).toHaveAttribute(
      "href",
      /^https:\/\/docs\.templatical\.com\//,
    );
    await expect(page.locator(SELECTORS.setupCardWiderScreen)).toBeVisible();
    await expect(page.locator(SELECTORS.editorContainer)).toHaveCount(0);
    await expect(page.locator(SELECTORS.setupCardProof)).toHaveCount(0);

    // The page fits the phone: nothing scrolls sideways.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBe(0);
  });

  test("the header keeps Back, the arrows and settings, and nothing that needs the editor", async ({
    page,
    scenePage,
  }) => {
    await scenePage.goto("fonts");
    await expect(page.locator(SELECTORS.backButton)).toHaveText("Back");
    await expect(page.getByTestId("scene-previous")).toBeVisible();
    await expect(page.getByTestId("scene-next")).toBeVisible();
    await expect(page.locator(SELECTORS.hostSettings)).toBeVisible();
    for (const selector of [
      SELECTORS.toolbarCode,
      SELECTORS.toolbarDocs,
      SELECTORS.shareButton,
      SELECTORS.exportButton,
      '[data-testid="toolbar-rail"]',
      '[data-testid="catalog-rail"]',
    ]) {
      await expect(page.locator(selector), selector).toHaveCount(0);
    }
    // The card carries the title, so the page holds exactly one.
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("the settings menu has no Show notes row", async ({
    page,
    scenePage,
  }) => {
    await scenePage.goto("fonts");
    await page.locator(SELECTORS.hostSettings).click();
    await expect(page.locator(SELECTORS.hostSettingsPanel)).toBeVisible();
    await expect(page.locator(SELECTORS.settingsShowNotes)).toHaveCount(0);
  });

  test("Copy copies the scene's snippet", async ({
    page,
    context,
    scenePage,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await scenePage.goto("fonts");
    const copy = page.locator(SELECTORS.setupCardCopy);
    await copy.click();
    await expect(copy).toHaveText("Copied!");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(
      await page.locator(SELECTORS.setupCardSnippet).innerText(),
    );
    expect(copied).toContain('import { init } from "@templatical/editor";');
    expect(copied).toContain("builtIns");
  });

  test("an example's card shows its captured email", async ({
    page,
    scenePage,
  }) => {
    await scenePage.goto("example-launchpad-launch");
    const proof = page.locator(SELECTORS.setupCardProof);
    await expect(proof).toHaveAttribute(
      "src",
      PROOFS["example-launchpad-launch"].src,
    );
    await expect(proof).toHaveAttribute(
      "alt",
      "Preview of the Launchpad launch email",
    );
    await expect
      .poll(() => proof.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("the i18n card keeps its locale picker", async ({
    page,
    scenePage,
  }) => {
    await scenePage.goto("i18n");
    const picker = page.getByTestId("scene-value-picker");
    await expect(picker).toHaveValue("de");
    await picker.selectOption("fr");
    await expect(page).toHaveURL(/[?&]locale=fr\b/);
    await expect(page.locator(SELECTORS.setupCardSnippet)).toContainText(
      'locale: "fr"',
    );
  });

  test("the arrows step to the next setup", async ({ page, scenePage }) => {
    await scenePage.goto("fonts");
    const next = page.getByTestId("scene-next");
    const label = (await next.getAttribute("aria-label")) ?? "";
    expect(label).toMatch(/^Next: \S/);
    await next.click();
    await expect(page).not.toHaveURL(/\/scenes\/fonts\b/);
    await expect(page.locator(SELECTORS.setupCard).locator("h1")).toHaveText(
      label.slice("Next: ".length),
    );
  });

  test("widening the window mounts the editor, and narrowing unmounts it", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("fonts");
    await expect(page.locator(SELECTORS.editorContainer)).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.setupCard)).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator(SELECTORS.setupCard)).toBeVisible();
    await expect(page.locator(SELECTORS.editorContainer)).toHaveCount(0);
    await expect(page.locator(".tpl-editor-host")).toHaveCount(0);
  });
});
