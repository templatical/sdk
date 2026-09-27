import type { Page } from "@playwright/test";
import en from "../../src/i18n/en";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { showNotes, skipNotes, stubNoteFont } from "../pages/scene.page";

const READY = '[data-testid="scene-host"][data-scene-ready="true"]';
const SCENE_NOTES_KEY = "tpl-playground-scene-notes-seen";

type SceneCopies = Record<string, { seeIt: string; note?: string }>;
const COPIES = en.scenes as SceneCopies;
const SETUP_IDS = Object.keys(COPIES);

/**
 * A returning visitor's visit: the general notes were seen on an earlier
 * scene, and `seen` lists the setups whose own notes were. Written only when
 * absent, so a reload keeps what the visit itself remembered.
 */
async function visit(
  page: Page,
  shadowDom: boolean,
  id: string,
  seen?: string[],
  // "domcontentloaded" when the test holds a stylesheet, which holds `load`.
  waitUntil: "load" | "domcontentloaded" = "load",
): Promise<void> {
  await page.addInitScript(
    ({ key, seen }) => {
      localStorage.setItem("tpl-playground-notes-seen", "true");
      if (seen && localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify(seen));
      }
    },
    { key: SCENE_NOTES_KEY, seen },
  );
  await page.goto(`/scenes/${id}?shadowDom=${shadowDom ? "1" : "0"}`, {
    waitUntil,
  });
  await page.locator(READY).waitFor();
}

function sceneNotes(page: Page) {
  return page.locator(SELECTORS.sceneNotes);
}

test.describe("Setup see-it", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await stubNoteFont(page);
  });

  for (const id of SETUP_IDS) {
    const { seeIt, note } = COPIES[id]!;

    test(`${id} says what it changes${note ? ", and points at it once" : ""}`, async ({
      page,
      shadowDom,
    }) => {
      await visit(page, shadowDom, id);

      await expect(page.getByTestId("scene-see-it")).toHaveText(
        seeIt.replaceAll("`", ""),
      );
      // The header's key is the rail row's, whichever of them names it; a
      // chip that picks the key's value shows the value too.
      const railCode =
        (await page
          .getByTestId(`rail-scene-${id}`)
          .locator("code")
          .textContent()) ?? "";
      const chip = page.getByTestId("scene-init-key");
      if ((await chip.locator("select").count()) > 0) {
        const key = railCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        await expect(chip.locator("code")).toHaveText(
          new RegExp(`^${key}: "[^"]+"$`),
        );
      } else {
        await expect(chip).toHaveText(railCode);
      }

      const host = page.getByTestId("scene-host");
      if (!note) {
        // Returning visitors see nothing new on a setup with no note.
        await expect(host).not.toHaveAttribute("data-notes", "open");
        return;
      }
      await expect(host).toHaveAttribute("data-notes", "open");
      await expect(sceneNotes(page)).toHaveAttribute("data-targets", "scene");
      await expect(page.locator("[data-note]")).toHaveCount(1);
      await expect(page.locator('[data-note="scene"]')).toContainText(note);
      expect(
        await page.evaluate(
          (key) => localStorage.getItem(key),
          SCENE_NOTES_KEY,
        ),
      ).toBe(JSON.stringify([id]));
    });
  }

  test("a seen note stays away on reload, and the next setup shows its own", async ({
    page,
    shadowDom,
  }) => {
    await visit(page, shadowDom, "fonts");
    await expect(page.locator('[data-note="scene"]')).toBeVisible();

    await page.reload();
    await page.locator(READY).waitFor();
    // The host marks the notes open in the same update that marks the scene
    // ready, so by now a note that was going to show would have.
    await expect(page.getByTestId("scene-host")).not.toHaveAttribute(
      "data-notes",
      "open",
    );

    await page.getByTestId("rail-scene-defaults").click();
    await page.locator(READY).waitFor();
    await expect(page.locator('[data-note="scene"]')).toContainText(
      COPIES.defaults!.note!,
    );
    expect(
      await page.evaluate((key) => localStorage.getItem(key), SCENE_NOTES_KEY),
    ).toBe(JSON.stringify(["fonts", "defaults"]));
  });

  test("the first scene of all shows the setup's note with every other", async ({
    page,
    shadowDom,
  }) => {
    await page.goto(`/scenes/fonts?shadowDom=${shadowDom ? "1" : "0"}`);
    await page.locator(READY).waitFor();
    await expect(sceneNotes(page)).toHaveAttribute(
      "data-targets",
      "scene code share properties issues preview palette rail",
    );
    await expect(page.locator('[data-note="scene"]')).toBeVisible();
  });

  for (const [id, replaced] of [
    ["issues", "issues"],
    ["defaults", "palette"],
    ["merge-tags-samples", "preview"],
  ] as const) {
    test(`Show notes on ${id} draws one arrow at its control`, async ({
      page,
      shadowDom,
    }) => {
      await visit(page, shadowDom, id, [id]);
      await expect(sceneNotes(page)).toHaveCount(0);

      await showNotes(page);
      await expect(page.locator('[data-note="scene"]')).toBeVisible();
      await expect(sceneNotes(page)).not.toHaveAttribute(
        "data-targets",
        new RegExp(`\\b${replaced}\\b`),
      );
      await expect(page.locator(`[data-note="${replaced}"]`)).toHaveCount(0);
    });
  }

  test("a setup's note waits for a control that renders after the notes open", async ({
    page,
    shadowDom,
  }) => {
    test.skip(shadowDom, "a page stylesheet cannot reach into a shadow root");
    // Hold the note font, so the notes measure only once the test lets them,
    // and hide the control until they have: the order that lost the version
    // history note when its toggle rendered a beat after the scene.
    let releaseFont!: () => void;
    const fontHeld = new Promise<void>((resolve) => (releaseFont = resolve));
    await page.route(/fonts\.bunny\.net\/css\?family=caveat/, async (route) => {
      await fontHeld;
      await route.fulfill({ contentType: "text/css", body: "" });
    });
    await page.addInitScript(() => {
      // The notes size themselves once this stylesheet's load event fires.
      document.addEventListener(
        "load",
        (event) => {
          const link = event.target as HTMLLinkElement;
          if (link.href?.includes("family=caveat")) {
            (window as { __noteFontLoaded?: boolean }).__noteFontLoaded = true;
          }
        },
        true,
      );
      // An init script runs before the document has a root element.
      const hide = () => {
        const style = document.createElement("style");
        style.id = "hold-control";
        style.textContent =
          '[data-testid="version-history-toggle"] { display: none !important; }';
        document.documentElement.appendChild(style);
      };
      if (document.documentElement) {
        hide();
      } else {
        new MutationObserver((_records, observer) => {
          if (!document.documentElement) return;
          observer.disconnect();
          hide();
        }).observe(document, { childList: true });
      }
    });
    await visit(
      page,
      shadowDom,
      "version-history",
      undefined,
      "domcontentloaded",
    );
    await expect(page.getByTestId("scene-host")).toHaveAttribute(
      "data-notes",
      "open",
    );

    releaseFont();
    // Past the notes' own font wait: the stylesheet's load event has fired,
    // every face that set off has settled, and the frames for the measure
    // have passed.
    await page.waitForFunction(
      () =>
        (window as { __noteFontLoaded?: boolean }).__noteFontLoaded === true,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (let frame = 0; frame < 10; frame += 1) {
        await new Promise(requestAnimationFrame);
      }
    });
    await expect(
      page.locator('[data-testid="version-history-toggle"]'),
    ).toBeHidden();
    await expect(page.locator(SELECTORS.sceneNotes)).toHaveCount(0);
    await page.evaluate(() =>
      document.getElementById("hold-control")?.remove(),
    );
    await expect(page.locator('[data-note="scene"]')).toContainText(
      COPIES["version-history"]!.note!,
    );
  });

  test("Defaults opens blank in its page colour, and a new Button arrives teal", async ({
    page,
    shadowDom,
  }) => {
    await skipNotes(page);
    await page.goto(`/scenes/defaults?shadowDom=${shadowDom ? "1" : "0"}`);
    await page.locator(READY).waitFor();

    await expect(page.locator("[data-block-type]")).toHaveCount(0);
    await expect(page.locator(".tpl-canvas-bg")).toHaveCSS(
      "background-color",
      "rgb(227, 241, 238)",
    );

    await page.locator('[data-palette-type="button"]').click();
    const button = page.locator('[data-block-type="button"] a');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveCSS("background-color", "rgb(15, 118, 110)");
  });
});
