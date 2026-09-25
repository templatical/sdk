import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { freezeMotion } from "../helpers/motion";
import { SELECTORS } from "../helpers/selectors";

const READY = '[data-testid="scene-host"][data-scene-ready="true"]';
// NOTE_IDS order, which is what data-targets lists.
const EVERY_TARGET =
  "code share docs preview viewport properties canvas palette rail";

/**
 * Serves the note font as an empty stylesheet, so the notes render in their
 * fallback face without reaching the network. Returns the requests seen.
 */
async function stubNoteFont(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.route(/fonts\.bunny\.net\/css\?family=caveat/, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "text/css", body: "" });
  });
  return requests;
}

/** A first visit: nothing has marked the notes as seen yet. */
async function firstVisit(page: Page, shadowDom: boolean, scene = "minimum") {
  await page.goto(`/scenes/${scene}?shadowDom=${shadowDom ? "1" : "0"}`);
  await page.locator(READY).waitFor();
}

test.describe("Scene notes", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await stubNoteFont(page);
  });

  test("the first scene finds every part to point at", async ({
    page,
    shadowDom,
  }) => {
    await firstVisit(page, shadowDom);
    const notes = page.locator(SELECTORS.sceneNotes);
    await expect(notes).toBeVisible();
    await expect(notes).toHaveAttribute("data-targets", EVERY_TARGET);
    await expect(notes).toHaveAccessibleName("Notes");
    await expect(page.locator(SELECTORS.notesButton)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator('[data-note="code"]')).toHaveText(
      "Code button: copy this setup",
    );
  });

  test("notes stay inside the viewport and clear of each other", async ({
    page,
    shadowDom,
  }) => {
    await firstVisit(page, shadowDom);
    const boxes = await page
      .locator("[data-note]")
      .evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().toJSON()),
      );
    expect(boxes.length).toBeGreaterThanOrEqual(5);
    for (const [i, a] of boxes.entries()) {
      expect(a.left).toBeGreaterThanOrEqual(8);
      expect(a.top).toBeGreaterThanOrEqual(8);
      expect(a.right).toBeLessThanOrEqual(1440 - 8);
      expect(a.bottom).toBeLessThanOrEqual(900 - 8);
      for (const b of boxes.slice(i + 1)) {
        const apart =
          a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top;
        expect(apart).toBe(true);
      }
    }
  });

  test("they show once: a reload does not bring them back", async ({
    page,
    shadowDom,
  }) => {
    await firstVisit(page, shadowDom);
    await expect(page.locator(SELECTORS.sceneNotes)).toBeVisible();
    await page.reload();
    await page.locator(READY).waitFor();
    await expect(page.locator(SELECTORS.notesButton)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);
  });

  test("the first click puts them away and still does its job", async ({
    page,
    shadowDom,
    editorPage,
  }) => {
    await firstVisit(page, shadowDom);
    await expect(page.locator(SELECTORS.sceneNotes)).toBeVisible();
    await expect(editorPage.getBlocks()).toHaveCount(0);

    await page.locator('[data-palette-type="title"]').click();
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);
    await expect(editorPage.getBlocks()).toHaveCount(1);
  });

  test("a key puts them away; a modifier on its own does not", async ({
    page,
    shadowDom,
  }) => {
    await firstVisit(page, shadowDom);
    const notes = page.locator(SELECTORS.sceneNotes);
    const button = page.locator(SELECTORS.notesButton);
    await expect(notes).toBeVisible();
    // The button's state, not the layer's visibility: a dismissed layer
    // stays visible while it fades, which would pass either way.
    await page.keyboard.press("Shift");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(notes).toHaveCount(0);
  });

  test("the pencil button brings them back and puts them away", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("minimum");
    const button = page.locator(SELECTORS.notesButton);
    const notes = page.locator(SELECTORS.sceneNotes);
    await expect(notes).toHaveCount(0);

    await button.click();
    await expect(notes).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click();
    await expect(notes).toHaveCount(0);
    await expect(button).toHaveAttribute("aria-pressed", "false");
  });

  test("the close pill puts them away", async ({ scenePage, page }) => {
    await scenePage.goto("minimum");
    await page.locator(SELECTORS.notesButton).click();
    await page.locator(SELECTORS.sceneNotesClose).click();
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);
  });

  test("a hidden rail takes its note with it", async ({ scenePage, page }) => {
    await scenePage.goto("minimum");
    await page.getByTestId("toolbar-rail").click();
    await expect(page.locator('[data-testid="catalog-rail"]')).toBeHidden();
    await page.locator(SELECTORS.notesButton).click();
    const notes = page.locator(SELECTORS.sceneNotes);
    await expect(notes).toBeVisible();
    await expect(notes).not.toHaveAttribute("data-targets", /rail/);
    await expect(page.locator('[data-note="rail"]')).toHaveCount(0);
  });

  test("the import paste panel keeps the editor's notes away", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("import-unlayer");
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
    await page.locator(SELECTORS.notesButton).click();
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveAttribute(
      "data-targets",
      "code share docs rail",
    );
  });

  test("the note font loads only when the notes show", async ({
    scenePage,
    page,
  }) => {
    const requests = await stubNoteFont(page);
    await scenePage.goto("minimum");
    expect(requests).toEqual([]);
    await page.locator(SELECTORS.notesButton).click();
    await expect(page.locator(SELECTORS.sceneNotes)).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test("arrows draw on, and reduced motion draws them at once", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("minimum");
    const stroke = page
      .locator('[data-note-arrow="code"] .pg-note-stroke')
      .first();
    const offset = () =>
      stroke.evaluate((el) => getComputedStyle(el).strokeDashoffset);

    const resume = await freezeMotion(page);
    await page.locator(SELECTORS.notesButton).click();
    await expect(stroke).toHaveCount(1);
    expect(await offset()).toBe("1px");
    await resume();
    await expect.poll(offset).toBe("0px");

    await page.locator(SELECTORS.notesButton).click();
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(SELECTORS.notesButton).click();
    await expect(stroke).toHaveCount(1);
    expect(await offset()).toBe("0px");
  });

  test("the notes follow the playground's language", async ({
    page,
    shadowDom,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-locale", "de");
    });
    await firstVisit(page, shadowDom);
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveAccessibleName(
      "Notizen",
    );
    await expect(page.locator('[data-note="code"]')).toHaveText(
      "Code-Schaltfläche: Setup kopieren",
    );
  });
});
