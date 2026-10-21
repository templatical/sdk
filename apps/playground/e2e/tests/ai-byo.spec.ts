import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { AiPage } from "../pages/ai.page";
import { EditorPage } from "../pages/editor.page";
import { ScenePage } from "../pages/scene.page";

/**
 * The AI setup: `init({ ai })` over `createMockAiProvider` playing
 * `AI_RECORDINGS` (no model, no keys). Every surface, through the public
 * `AiProvider` contract. Recordings: chat answers "dark", "title" and "fail"
 * specially and otherwise adds a closing line; rewrite prefixes "✨ ".
 */

const ORIGINAL_TITLE = "Your March product update";

async function openScene(page: Page, shadowDom: boolean, query: Record<string, string> = {}) {
  const editor = new EditorPage(page);
  await new ScenePage(page, { shadowDom }).goto("ai", query);
  await editor.waitForReady();
  await editor.dismissOverlays();
  return { editor, ai: new AiPage(page) };
}

test.describe("AI over a BYO provider", () => {
  test("chat says it's AI, offers starters, changes the template and undoes the turn", async ({ page, shadowDom }) => {
    const { ai } = await openScene(page, shadowDom);

    await ai.openPanel("chat");
    await expect(page.locator('[data-testid="ai-panel-subtitle"]')).toHaveText("Replies and changes come from AI.");
    await expect(page.locator('[data-testid="ai-chat-suggestion"]')).toHaveCount(4);

    await ai.ask("Change the title");
    await expect(ai.lastReply()).toHaveText("Updating the title. It now reads “Hello there”.");
    await expect(ai.lastApplied()).toContainText("Applied 1 change");
    await expect(ai.title()).toContainText("Hello there");
    await expect(ai.title().locator('[data-testid="block-agent-highlight"]')).toBeVisible();

    await ai.lastUndo().click();
    await expect(ai.lastApplied()).toContainText("Undone");
    await expect(ai.title()).toContainText(ORIGINAL_TITLE);

    await ai.lastUndo().click();
    await expect(ai.title()).toContainText("Hello there");
  });

  test("Cmd/Ctrl+Z reverts a whole turn", async ({ page, shadowDom }) => {
    const { ai, editor } = await openScene(page, shadowDom);
    await ai.openPanel("chat");
    await ai.ask("Change the title");
    await expect(ai.title()).toContainText("Hello there");

    await editor.clickCanvasAwayFromSidebar();
    await page.keyboard.press("ControlOrMeta+z");

    await expect(ai.title()).toContainText(ORIGINAL_TITLE);
  });

  test("a failed turn says why and gives the prompt back", async ({ page, shadowDom }) => {
    const { ai } = await openScene(page, shadowDom);
    await ai.openPanel("chat");

    await ai.ask("This will fail");

    await expect(page.locator('[data-testid="ai-chat-error"]')).toHaveText(
      "AI is unavailable right now. Try again later.",
    );
    await expect(page.locator('[data-testid="ai-chat-input"]')).toHaveValue("This will fail");
  });

  test("history survives closing the chat, with New chat to clear it", async ({ page, shadowDom }) => {
    const { ai } = await openScene(page, shadowDom, { history: "1" });
    await ai.openPanel("chat");
    await ai.ask("Use a dark background");
    await expect(ai.lastApplied()).toContainText("Applied 1 change");

    await page.locator('[data-testid="ai-panel-close"]').click();
    await ai.openPanel("chat");
    await expect(page.locator('[data-testid="ai-chat-prompt"]')).toHaveText(["Use a dark background"]);

    await page.locator('[data-testid="ai-chat-new"]').click();
    await expect(page.locator('[data-testid="ai-chat-prompt"]')).toHaveCount(0);
  });

  test("rewrite streams into a labelled preview and Replace makes it the user's edit", async ({ page, shadowDom }) => {
    const { editor } = await openScene(page, shadowDom);
    await editor.doubleClickBlock("paragraph");

    const toolbar = editor.getTextToolbar();
    await toolbar.locator('[data-testid="ai-rewrite-trigger"]').click();
    await toolbar.locator('[data-testid="ai-rewrite-preset-shorten"]').click();

    await expect(toolbar.locator('[data-testid="ai-rewrite-label"]')).toHaveText("AI suggestion");
    await expect(toolbar.locator('[data-testid="ai-rewrite-preview"]')).toContainText("✨ Three releases");
    await toolbar.locator('[data-testid="ai-rewrite-replace"]').click();

    await expect(page.locator('[data-block-type="paragraph"]').first()).toContainText("✨ Three releases");
  });

  test("scoring shows three categories, links to Issues, and fixes a finding with Undo", async ({ page, shadowDom }) => {
    const { ai } = await openScene(page, shadowDom);
    await ai.openPanel("scoring");

    await expect(page.locator('[data-testid="scoring-overall"]')).toContainText("78");
    await expect(page.locator('[data-testid="scoring-category"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="scoring-accessibility-note"]')).toContainText(
      "Accessibility is checked in the Issues panel.",
    );

    await page.locator('[data-testid="scoring-fix"]').first().click();
    await expect(page.locator('[data-testid="scoring-fixed"]')).toBeVisible();
    await expect(page.locator('[data-block-type="paragraph"]').first()).toContainText("A shorter, clearer line.");

    await page.locator('[data-testid="scoring-undo-fix"]').click();
    await expect(page.locator('[data-testid="scoring-fixed"]')).toHaveCount(0);
    await expect(page.locator('[data-block-type="paragraph"]').first()).toContainText("Three releases landed");
  });

  test("design builds a template from an image, with Undo", async ({ page, shadowDom }) => {
    const { ai } = await openScene(page, shadowDom);
    await ai.openPanel("design");

    await page.locator('[data-testid="ai-design-file"]').setInputFiles({
      name: "shot.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page.locator('[data-testid="ai-design-build"]').click();
    await page.locator('[data-testid="ai-design-replace"]').click();

    await expect(page.locator('[data-testid="ai-design-built"]')).toContainText("Template built from your design.");
    await expect(ai.title()).toContainText("Built from your design");

    await page.locator('[data-testid="ai-design-undo"]').click();
    await expect(ai.title()).toContainText(ORIGINAL_TITLE);
  });

  test("other editors see the AI's batch as AI (for Ada); the editor that asked sees only the outline", async ({
    context,
    shadowDom,
  }: {
    context: BrowserContext;
    shadowDom: boolean;
  }) => {
    const adaPage = await context.newPage();
    const ada = await openScene(adaPage, shadowDom, { collaboration: "1", user: "Ada" });
    const gracePage = await context.newPage();
    await openScene(gracePage, shadowDom, { collaboration: "1", user: "Grace" });

    await ada.ai.openPanel("chat");
    await ada.ai.ask("Change the title");
    await expect(ada.ai.title()).toContainText("Hello there");

    await expect(gracePage.locator('[data-kind="aiEdited"]')).toHaveText("AI (for Ada) changed a block.");
    await expect(gracePage.locator('[data-block-type="title"]').first()).toContainText("Hello there");
    await expect(adaPage.locator('[data-kind="aiEdited"]')).toHaveCount(0);
    await expect(ada.ai.title().locator('[data-testid="block-agent-highlight"]')).toBeVisible();
  });
});
