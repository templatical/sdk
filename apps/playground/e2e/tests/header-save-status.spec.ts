import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { EditorPage } from "../pages/editor.page";
import { ScenePage } from "../pages/scene.page";

/**
 * The save-status words ("Unsaved", "Saved") appear on every edit and leave
 * seconds after each save. They must never move the header into its compact
 * layout: in an editor just wide enough for the full header, an edit keeps the
 * full header and shows the badge's glyph alone. Before the fix the words were
 * counted twice (the side tracks are kept equal) and the header went compact
 * for the whole Unsaved-then-Saved window.
 */
test("the save status never compacts the header", async ({
  page,
  shadowDom,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const editor = new EditorPage(page);
  await new ScenePage(page, { shadowDom }).goto("templates");
  await editor.waitForReady();
  await editor.dismissOverlays();

  const container = page.locator(SELECTORS.editorContainer);
  const header = container.locator(".tpl-header");
  await expect
    .poll(async () => Number(await header.getAttribute("data-full-width")))
    .toBeGreaterThan(0);
  const required = Number(await header.getAttribute("data-full-width"));
  const setWidth = (width: number) =>
    container.evaluate((element, px) => {
      (element as HTMLElement).style.width = `${px}px`;
      (element as HTMLElement).style.flex = "none";
    }, width);

  await setWidth(Math.ceil(required) + 8);
  await expect(header).toHaveAttribute("data-compact", "false");

  await editor.clickPaletteItem("paragraph");
  const unsaved = container.locator(SELECTORS.saveStatusUnsaved);
  await expect(unsaved).toBeVisible();
  await expect(unsaved).toHaveAttribute("title", "Unsaved");
  await expect(header).toHaveAttribute("data-compact", "false");
  await expect(header).toHaveAttribute("data-status-label", "false");
  expect(Number(await header.getAttribute("data-full-width"))).toBe(required);
  const hiddenLabel = await unsaved.locator(".tpl-status-label").boundingBox();
  expect(hiddenLabel?.width).toBeLessThanOrEqual(1);

  // With room to spare the words come back, still in the full header.
  await setWidth(Math.ceil(required) + 400);
  await expect(header).toHaveAttribute("data-status-label", "true");
  await expect(header).toHaveAttribute("data-compact", "false");
  await expect(unsaved.locator(".tpl-status-label")).toHaveText("Unsaved");
  const label = await unsaved.locator(".tpl-status-label").boundingBox();
  expect(label?.width).toBeGreaterThan(20);
});
