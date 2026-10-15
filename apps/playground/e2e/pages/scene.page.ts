import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { SELECTORS } from "../helpers/selectors";

/**
 * Every scene id, read off the agent surface's one page per scene, which
 * tests/build-agent-surface.test.ts keeps equal to the registry.
 */
export const SCENE_IDS: readonly string[] = readdirSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../public/scenes"),
)
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.slice(0, -".md".length));

/**
 * Marks every note seen, the general ones and each setup's own, so a spec
 * opens its scene with nothing drawn over it. A spec about the notes
 * navigates without it.
 */
export async function skipNotes(page: Page): Promise<void> {
  await page.addInitScript((ids) => {
    localStorage.setItem("tpl-playground-notes-seen", "true");
    localStorage.setItem(
      "tpl-playground-scene-notes-seen",
      JSON.stringify(ids),
    );
  }, SCENE_IDS);
}

/**
 * Serves the note font as an empty stylesheet, so the notes render in their
 * fallback face without reaching the network. Returns the requests seen.
 */
export async function stubNoteFont(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.route(/fonts\.bunny\.net\/css\?family=caveat/, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "text/css", body: "" });
  });
  return requests;
}

/** Opens the notes from the header's settings menu, where they live. */
export async function showNotes(page: Page): Promise<void> {
  await page.locator(SELECTORS.hostSettings).click();
  await page.locator(SELECTORS.settingsShowNotes).click();
  await expect(page.locator(SELECTORS.sceneNotes)).toBeVisible();
}

const SCENE_READY = '[data-testid="scene-host"][data-scene-ready="true"]';

export class ScenePage {
  constructor(
    private page: Page,
    private options: { shadowDom?: boolean } = {},
  ) {}

  async goto(id: string, query: Record<string, string> = {}) {
    await skipNotes(this.page);
    const params = new URLSearchParams(query);
    params.set("shadowDom", this.options.shadowDom ? "1" : "0");
    await this.page.goto(`/scenes/${id}?${params.toString()}`);
    await this.page.waitForSelector(SCENE_READY);
  }

  /**
   * Opens `content` the way a share link does, at `/?s=<id>`, with the share
   * service mocked to return it. The share records the Minimum scene, so the
   * canvas holds `content` and nothing else.
   */
  async openShare(id: string, content: unknown) {
    await skipNotes(this.page);
    await this.page.route(`**/api/shares/${id}`, async (route) => {
      // Answers the load only; anything else at this URL reaches the network.
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          sceneId: "minimum",
          content,
          createdAt: "2026-10-15T00:00:00.000Z",
        }),
      });
    });
    const params = new URLSearchParams({
      s: id,
      shadowDom: this.options.shadowDom ? "1" : "0",
    });
    await this.page.goto(`/?${params.toString()}`);
    await this.page.waitForSelector(SCENE_READY);
  }
}
