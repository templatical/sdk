import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { EditorPage } from "../pages/editor.page";
import { ScenePage } from "../pages/scene.page";

/**
 * The Collaboration setup: tabs of one browser context share the playground's
 * SharedWorker backend (`src/host/collaboration/`), so this drives the public
 * `CollaborationProvider` contract end to end, with no Cloud involved. Each
 * test gets a fresh context, and with it a fresh worker and template.
 */

interface Tab {
  page: Page;
  editor: EditorPage;
}

async function openTab(
  context: BrowserContext,
  shadowDom: boolean,
  user?: string,
): Promise<Tab> {
  const page = await context.newPage();
  const editor = new EditorPage(page);
  await new ScenePage(page, { shadowDom }).goto(
    "collaboration",
    user ? { user } : {},
  );
  await editor.waitForReady();
  await editor.dismissOverlays();
  return { page, editor };
}

const DIVIDER = '[data-block-type="divider"]';

function avatars(tab: Tab) {
  return tab.page.locator('[data-testid="collaborator-avatar"]');
}

function lockOn(tab: Tab, selector: string) {
  return tab.page
    .locator(selector)
    .first()
    .locator('[data-testid="block-lock"]');
}

test.describe("collaboration over a BYO provider", () => {
  test("shows everyone else, a tab without a name as Guest", async ({
    context,
    shadowDom,
  }) => {
    const ada = await openTab(context, shadowDom, "Ada");
    const grace = await openTab(context, shadowDom, "Grace");

    await expect(avatars(ada)).toHaveCount(1);
    await expect(avatars(ada).first()).toHaveAttribute("title", "Grace");
    await expect(avatars(grace).first()).toHaveAttribute("title", "Ada");

    await openTab(context, shadowDom);
    await expect(avatars(ada)).toHaveCount(2);
    await expect(avatars(ada).nth(1)).toHaveAttribute("title", "Guest");
    await expect(avatars(ada).nth(1)).toHaveAttribute(
      "data-person-type",
      "guest",
    );
  });

  test("sends edits both ways", async ({ context, shadowDom }) => {
    const ada = await openTab(context, shadowDom, "Ada");
    const grace = await openTab(context, shadowDom, "Grace");
    const count = await ada.editor.getBlockCount();

    await ada.editor.clickPaletteItem("divider");
    await expect.poll(() => grace.editor.getBlockCount()).toBe(count + 1);
    // The new block is Ada's selection, so Ada holds it until letting go.
    await ada.editor.deselectBlock();
    await expect(lockOn(grace, DIVIDER)).toHaveCount(0);

    await grace.editor.selectBlockByType("divider");
    await grace.editor.deleteSelectedBlock();
    await expect.poll(() => ada.editor.getBlockCount()).toBe(count);
  });

  test("shows another tab's text edit on the canvas", async ({
    context,
    shadowDom,
  }) => {
    // A remote updateBlock lands in place on the canvas's reactive content;
    // asserting the rendered text, not the model, is what catches a write
    // the reactive proxy never sees.
    const ada = await openTab(context, shadowDom, "Ada");
    const grace = await openTab(context, shadowDom, "Grace");
    const paragraph = grace.page
      .locator('[data-block-type="paragraph"]')
      .first();
    await expect(paragraph).toContainText("Three releases landed this month.");

    await ada.editor.doubleClickBlock("paragraph");
    await ada.editor.focusTextEditableAtEnd("paragraph");
    await ada.page.keyboard.type(" Edited by Ada.");

    await expect(paragraph).toContainText(
      "what it means for your team. Edited by Ada.",
    );
  });

  test("outlines a block another tab is editing, and won't select it", async ({
    context,
    shadowDom,
  }) => {
    const ada = await openTab(context, shadowDom, "Ada");
    const grace = await openTab(context, shadowDom, "Grace");

    await ada.editor.selectBlock(0);
    const lock = lockOn(grace, SELECTORS.block);
    await expect(lock).toBeVisible();
    await expect(lock).toContainText("Ada is editing");

    await grace.editor.getBlocks().first().click();
    await expect(grace.page.locator(SELECTORS.blockSelected)).toHaveCount(0);

    await ada.editor.deselectBlock();
    await expect(lock).toHaveCount(0);
  });

  test("skips an undo step the other tab overtook, and says so", async ({
    context,
    shadowDom,
  }) => {
    const ada = await openTab(context, shadowDom, "Ada");
    const grace = await openTab(context, shadowDom, "Grace");
    const count = await ada.editor.getBlockCount();

    await ada.editor.clickPaletteItem("divider");
    await ada.editor.deselectBlock();
    await expect.poll(() => grace.editor.getBlockCount()).toBe(count + 1);
    await expect(lockOn(grace, DIVIDER)).toHaveCount(0);
    await grace.editor.selectBlockByType("divider");
    await grace.editor.deleteSelectedBlock();
    await expect.poll(() => ada.editor.getBlockCount()).toBe(count);

    // Ada's undo would delete the divider Grace already deleted.
    await ada.page.keyboard.press("Meta+z");

    await expect(
      ada.page.locator(
        '[data-testid="collaboration-notice"][data-kind="undoSkipped"]',
      ),
    ).toContainText("Couldn't undo that step");
    await expect.poll(() => ada.editor.getBlockCount()).toBe(count);
    await expect.poll(() => grace.editor.getBlockCount()).toBe(count);
  });
});
