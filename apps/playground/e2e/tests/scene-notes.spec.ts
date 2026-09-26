import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { freezeMotion } from "../helpers/motion";
import { SELECTORS } from "../helpers/selectors";

const READY = '[data-testid="scene-host"][data-scene-ready="true"]';
// NOTE_IDS order, which is what data-targets lists.
const EVERY_TARGET = "code share properties issues preview palette rail";

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

/** Opens the notes from the header's settings menu, where they live. */
async function showNotes(page: Page) {
  await page.locator(SELECTORS.hostSettings).click();
  await page.locator(SELECTORS.settingsShowNotes).click();
  await expect(page.locator(SELECTORS.sceneNotes)).toBeVisible();
}

/**
 * The notes' open state, from the scene host. A dismissed layer stays
 * visible while it fades, so its visibility would pass either way.
 */
function host(page: Page) {
  return page.getByTestId("scene-host");
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
    await expect(host(page)).toHaveAttribute("data-notes", "open");
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

  test("notes sit on the email when that is where their spot is", async ({
    page,
    shadowDom,
  }) => {
    await firstVisit(page, shadowDom, "example-launchpad-launch");
    const canvas = (await page
      .locator('[data-testid="canvas-wrapper"]')
      .boundingBox())!;
    for (const id of ["preview", "palette"]) {
      const locator = page.locator(`[data-note="${id}"]`);
      await expect(locator).toBeVisible();
      const note = (await locator.boundingBox())!;
      const over =
        note.x < canvas.x + canvas.width &&
        canvas.x < note.x + note.width &&
        note.y < canvas.y + canvas.height &&
        canvas.y < note.y + note.height;
      expect(over, `${id} note over the email`).toBe(true);
    }
  });

  test("the preview note sits well below its toggle, on a long arrow", async ({
    page,
    shadowDom,
  }) => {
    await firstVisit(page, shadowDom);
    await expect(page.locator('[data-note="preview"]')).toBeVisible();
    // Its arrow leaves from the note's far end, so length alone passes a
    // note crammed right under the toggle: the gap is what says it isn't.
    const gap = await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="editor-container"]',
      );
      const root = container?.shadowRoot ?? container;
      const toggle = root?.querySelector('[role="radiogroup"]')?.parentElement
        ?.lastElementChild;
      const note = document.querySelector('[data-note="preview"]');
      return (
        note!.getBoundingClientRect().top -
        toggle!.getBoundingClientRect().bottom
      );
    });
    expect(gap).toBeGreaterThan(50);
    const length = await page
      .locator('[data-note-arrow="preview"] .pg-note-stroke')
      .first()
      .evaluate((el) => (el as SVGPathElement).getTotalLength());
    expect(length).toBeGreaterThan(45);
  });

  test("they show once: a reload does not bring them back", async ({
    page,
    shadowDom,
  }) => {
    await firstVisit(page, shadowDom);
    await expect(page.locator(SELECTORS.sceneNotes)).toBeVisible();
    await page.reload();
    await page.locator(READY).waitFor();
    await expect(host(page)).not.toHaveAttribute("data-notes");
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
    await expect(notes).toBeVisible();
    await page.keyboard.press("Shift");
    await expect(host(page)).toHaveAttribute("data-notes", "open");
    await page.keyboard.press("Escape");
    await expect(host(page)).not.toHaveAttribute("data-notes");
    await expect(notes).toHaveCount(0);
  });

  test("the settings menu brings them back, and closes behind itself", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("minimum");
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);

    await showNotes(page);
    await expect(host(page)).toHaveAttribute("data-notes", "open");
    await expect(page.locator(SELECTORS.hostSettingsPanel)).toHaveCount(0);
    await expect(page.locator(SELECTORS.hostSettings)).toBeFocused();
    // The notes open once the menu is gone, so Code's note draws on a clear
    // header. (Share's depends on the note font's width, and the stubbed
    // fallback face is wider than Caveat.)
    await expect(page.locator('[data-note="code"]')).toBeVisible();
  });

  test("the home page's settings menu offers no notes", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await page.locator(SELECTORS.hostSettings).click();
    await expect(page.locator(SELECTORS.hostSettingsPanel)).toBeVisible();
    await expect(page.locator(SELECTORS.settingsShowNotes)).toHaveCount(0);
  });

  test("the close pill puts them away", async ({ scenePage, page }) => {
    await scenePage.goto("minimum");
    await showNotes(page);
    await page.locator(SELECTORS.sceneNotesClose).click();
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);
  });

  test("a hidden rail takes its note with it", async ({ scenePage, page }) => {
    await scenePage.goto("minimum");
    await page.getByTestId("toolbar-rail").click();
    await expect(page.locator('[data-testid="catalog-rail"]')).toBeHidden();
    await showNotes(page);
    const notes = page.locator(SELECTORS.sceneNotes);
    await expect(notes).not.toHaveAttribute("data-targets", /rail/);
    await expect(page.locator('[data-note="rail"]')).toHaveCount(0);
  });

  test("the import paste panel keeps the editor's notes away", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("import-unlayer");
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
    await showNotes(page);
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveAttribute(
      "data-targets",
      "code share rail",
    );
  });

  test("the note font loads only when the notes show", async ({
    scenePage,
    page,
  }) => {
    const requests = await stubNoteFont(page);
    await scenePage.goto("minimum");
    expect(requests).toEqual([]);
    await showNotes(page);
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

    await page.locator(SELECTORS.hostSettings).click();
    const resume = await freezeMotion(page);
    await page.locator(SELECTORS.settingsShowNotes).click();
    await expect(stroke).toHaveCount(1);
    expect(await offset()).toBe("1px");
    await resume();
    await expect.poll(offset).toBe("0px");

    await page.locator(SELECTORS.sceneNotesClose).click();
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await showNotes(page);
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
