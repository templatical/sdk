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

async function openScene(
  page: Page,
  shadowDom: boolean,
  query: Record<string, string> = {},
) {
  const editor = new EditorPage(page);
  await new ScenePage(page, { shadowDom }).goto("ai", query);
  await editor.waitForReady();
  await editor.dismissOverlays();
  return { editor, ai: new AiPage(page) };
}

test.describe("AI over a BYO provider", () => {
  test("the AI assistant button opens chat and a second click closes it", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom);
    await expect(ai.menu()).toHaveAttribute("aria-pressed", "false");
    await ai.openPanel("chat");
    await expect(ai.menu()).toHaveAttribute("aria-pressed", "true");
    await ai.menu().click();
    await expect(page.getByTestId("ai-panel-chat")).toBeHidden();
    await expect(ai.menu()).toHaveAttribute("aria-pressed", "false");
  });

  test("chat says it's AI, changes the template and undoes the turn", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom);

    await ai.openPanel("chat");
    await expect(page.locator('[data-testid="ai-panel-subtitle"]')).toHaveText(
      "Replies and changes come from AI.",
    );

    await ai.ask("Change the title");
    await expect(ai.lastReply()).toHaveText(
      "Updating the title. It now reads “Hello there”.",
    );
    await expect(ai.lastApplied()).toContainText("Applied 1 change");
    await expect(ai.title()).toContainText("Hello there");
    await expect(
      ai.title().locator('[data-testid="block-agent-highlight"]'),
    ).toBeVisible();

    await ai.lastUndo().click();
    await expect(ai.lastApplied()).toContainText("Undone");
    await expect(ai.title()).toContainText(ORIGINAL_TITLE);

    await ai.lastUndo().click();
    await expect(ai.title()).toContainText("Hello there");
  });

  for (const { empty, starters } of [
    {
      empty: true,
      starters: [
        "Draft a welcome email for new customers",
        "Create a product launch announcement",
        "Build a monthly newsletter layout",
      ],
    },
    {
      empty: false,
      starters: [
        "Shorten the copy",
        "Make the tone friendlier",
        "Update the dates and the offer",
        "Add a clear call to action",
      ],
    },
  ]) {
    test(`static starters for an ${empty ? "empty" : "filled"} template send their displayed text`, async ({
      page,
      shadowDom,
    }) => {
      const { ai, editor } = await openScene(page, shadowDom);
      if (empty) {
        while ((await editor.getBlocks().count()) > 0) {
          const count = await editor.getBlocks().count();
          await editor.selectBlock(0);
          await editor.deleteSelectedBlock();
          await expect
            .poll(() => editor.getBlocks().count())
            .toBeLessThan(count);
        }
      }
      await ai.openPanel("chat");
      const buttons = page.locator('[data-testid="ai-chat-starter"]');
      await expect(buttons).toHaveText(starters);
      await buttons.first().click();
      await expect(page.locator('[data-testid="ai-chat-prompt"]')).toHaveText([
        starters[0],
      ]);
      await expect(ai.lastReply()).toHaveText(
        "Adding a closing line at the end. I added it below the last block.",
      );
    });
  }

  test("Cmd/Ctrl+Z reverts a whole turn", async ({ page, shadowDom }) => {
    const { ai, editor } = await openScene(page, shadowDom);
    await ai.openPanel("chat");
    await ai.ask("Change the title");
    await expect(ai.title()).toContainText("Hello there");

    await editor.clickCanvasAwayFromSidebar();
    await page.keyboard.press("ControlOrMeta+z");

    await expect(ai.title()).toContainText(ORIGINAL_TITLE);
  });

  test("a failed turn says why and gives the prompt back", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom);
    await ai.openPanel("chat");

    await ai.ask("This will fail");

    await expect(page.locator('[data-testid="ai-chat-error"]')).toHaveText(
      "AI is unavailable right now. Try again later.",
    );
    await expect(page.locator('[data-testid="ai-chat-input"]')).toHaveValue(
      "This will fail",
    );
  });

  test("history survives closing the chat, with New chat to clear it", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom, { history: "1" });
    await ai.openPanel("chat");
    await ai.ask("Use a dark background");
    await expect(ai.lastApplied()).toContainText("Applied 1 change");

    await page.locator('[data-testid="ai-panel-close"]').click();
    await ai.openPanel("chat");
    await expect(page.locator('[data-testid="ai-chat-prompt"]')).toHaveText([
      "Use a dark background",
    ]);

    await page.locator('[data-testid="ai-chat-new"]').click();
    await expect(page.locator('[data-testid="ai-chat-prompt"]')).toHaveCount(0);
  });

  test("rewrite streams into a labelled preview and Replace makes it the user's edit", async ({
    page,
    shadowDom,
  }) => {
    const { editor } = await openScene(page, shadowDom);
    await editor.doubleClickBlock("paragraph");

    const toolbar = editor.getTextToolbar();
    await toolbar.locator('[data-testid="ai-rewrite-trigger"]').click();
    await toolbar.locator('[data-testid="ai-rewrite-preset-shorten"]').click();

    await expect(
      toolbar.locator('[data-testid="ai-rewrite-label"]'),
    ).toHaveText("AI suggestion");
    await expect(
      toolbar.locator('[data-testid="ai-rewrite-preview"]'),
    ).toContainText("✨ Three releases");
    await toolbar.locator('[data-testid="ai-rewrite-replace"]').click();

    await expect(
      page.locator('[data-block-type="paragraph"]').first(),
    ).toContainText("✨ Three releases");
  });

  for (const { ruleId, blockId, before, after, href } of [
    {
      ruleId: "a11y.link-vague-text",
      blockId: "ai-vague-link",
      before: "click here",
      after: "Read the March update",
      href: "https://example.com/march",
    },
    {
      ruleId: "deliverability.link-text-domain-mismatch",
      blockId: "ai-domain-link",
      before: "www.acme.com",
      after: "Visit Acme",
      href: "https://tracking.example.net/r/1",
    },
  ]) {
    test(`Fix with AI resolves ${ruleId} and one undo restores its text and finding`, async ({
      page,
      shadowDom,
    }) => {
      const { ai } = await openScene(page, shadowDom, { issues: "1" });
      await ai.openIssues();
      await ai.expectFindings(ruleId, [blockId]);
      const row = await ai.finding(ruleId, blockId);
      await row.getByTestId("issue-ai-fix").click();
      await expect(ai.block(blockId)).toContainText(after);
      await expect(ai.block(blockId).locator("a")).toHaveAttribute(
        "href",
        href,
      );
      await ai.expectFindings(ruleId, []);
      await ai.undo();
      await expect(ai.block(blockId)).toContainText(before);
      await expect(ai.block(blockId).locator("a")).toHaveAttribute(
        "href",
        href,
      );
      await ai.expectFindings(ruleId, [blockId]);
    });
  }

  test("Write alt text accepts a draft and Mark decorative clears another image's finding", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom, { issues: "1" });
    const rule = "a11y.img-missing-alt";
    await ai.openIssues();
    await ai.expectFindings(rule, ["ai-image-1", "ai-image-2", "ai-image-3"]);
    let row = await ai.finding(rule, "ai-image-1");
    await row.getByTestId("issue-ai-alt-text").click();
    await expect(row.getByRole("textbox")).toHaveValue("Shop new arrivals");
    await row.getByRole("button", { name: "Accept", exact: true }).click();
    await ai.expectFindings(rule, ["ai-image-2", "ai-image-3"]);
    row = await ai.finding(rule, "ai-image-2");
    await row.getByTestId("issue-ai-alt-text").click();
    await expect(row.getByRole("textbox")).toHaveValue("Shop new arrivals");
    await row
      .getByRole("button", { name: "Mark decorative", exact: true })
      .click();
    await ai.expectFindings(rule, ["ai-image-3"]);
    const content = await ai.content();
    expect(
      content.blocks.find((block) => block.id === "ai-image-1"),
    ).toMatchObject({ alt: "Shop new arrivals", decorative: false });
    expect(
      content.blocks.find((block) => block.id === "ai-image-2"),
    ).toMatchObject({ alt: "", decorative: true });
  });

  test("bulk alt text applies two of three reviews as one undo step", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom, { issues: "1" });
    const rule = "a11y.img-missing-alt";
    await ai.openIssues();
    await ai.expectFindings(rule, ["ai-image-1", "ai-image-2", "ai-image-3"]);
    await page
      .getByRole("button", { name: "Write missing alt text (3)", exact: true })
      .click();
    const review = page.getByTestId("ai-alt-text-review");
    const rows = review.getByTestId("ai-alt-text-row");
    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) {
      await expect(row.getByRole("textbox")).toHaveValue("Shop new arrivals");
      await expect(
        row.getByRole("switch", { name: "Accept", exact: true }),
      ).toBeChecked();
    }
    await rows
      .nth(2)
      .getByRole("switch", { name: "Accept", exact: true })
      .click();
    await review
      .getByRole("button", { name: "Apply accepted (2)", exact: true })
      .click();
    await expect(review).toHaveCount(0);
    await ai.expectFindings(rule, ["ai-image-3"]);
    await ai.undo();
    await ai.expectFindings(rule, ["ai-image-1", "ai-image-2", "ai-image-3"]);
  });

  test("altText false hides single and bulk entries while Fix with AI stays available", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom, {
      issues: "1",
      noAltText: "1",
    });
    await ai.openIssues();
    await ai.expectFindings("a11y.img-missing-alt", [
      "ai-image-1",
      "ai-image-2",
      "ai-image-3",
    ]);
    await expect(
      (await ai.finding("a11y.link-vague-text", "ai-vague-link")).getByTestId(
        "issue-ai-fix",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("issue-ai-alt-text")).toHaveCount(0);
    await expect(page.getByTestId("issue-ai-alt-text-bulk")).toHaveCount(0);
  });

  test("the attach control sends a PNG with the chat turn and keeps its name in history", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom);
    await ai.openPanel("chat");
    await ai.attachPng();
    await expect(page.getByTestId("ai-chat-attachment")).toContainText(
      "design.png",
    );
    await ai.ask("Build this email from the attached design.");
    await expect(ai.title()).toContainText("Built from your design");
    await expect(ai.lastReply()).toHaveText(
      "Built the email from your design. Pictures are placeholders.",
    );
    await expect(page.getByTestId("ai-chat-history-attachment")).toHaveText(
      "design.png",
    );
    await expect(page.getByTestId("ai-chat-attachment")).toHaveCount(0);
  });

  test("dragging a PDF onto chat shows the drop state and attaches the file", async ({
    page,
    shadowDom,
  }) => {
    const { ai } = await openScene(page, shadowDom);
    await ai.openPanel("chat");
    await ai.dropPdf();
    await expect(page.getByTestId("ai-chat-attachment")).toContainText(
      "design.pdf",
    );
    await expect(page.getByTestId("ai-chat-reply")).toHaveCount(0);
  });

  test("the empty canvas import shortcut opens chat with an attachment and an unsent request", async ({
    page,
    shadowDom,
  }) => {
    const { ai, editor } = await openScene(page, shadowDom);
    while ((await editor.getBlocks().count()) > 0) {
      const count = await editor.getBlocks().count();
      await editor.selectBlock(0);
      await editor.deleteSelectedBlock();
      await expect.poll(() => editor.getBlocks().count()).toBeLessThan(count);
    }
    await ai.importPng();
    await expect(page.getByTestId("ai-chat-attachment")).toContainText(
      "design.png",
    );
    await expect(page.getByTestId("ai-chat-input")).toHaveValue(
      "Build this email from the attached design.",
    );
    await expect(page.getByTestId("ai-chat-send")).toBeEnabled();
    await expect(page.getByTestId("ai-chat-prompt")).toHaveCount(0);
    await expect(page.getByTestId("ai-chat-reply")).toHaveCount(0);
    await expect(editor.getBlocks()).toHaveCount(0);
  });

  test("other editors see the AI's batch as AI (for Ada); the editor that asked sees only the outline", async ({
    context,
    shadowDom,
  }: {
    context: BrowserContext;
    shadowDom: boolean;
  }) => {
    const adaPage = await context.newPage();
    const ada = await openScene(adaPage, shadowDom, {
      collaboration: "1",
      user: "Ada",
    });
    const gracePage = await context.newPage();
    await openScene(gracePage, shadowDom, {
      collaboration: "1",
      user: "Grace",
    });

    await ada.ai.openPanel("chat");
    await ada.ai.ask("Change the title");
    await expect(ada.ai.title()).toContainText("Hello there");

    await expect(gracePage.locator('[data-kind="aiEdited"]')).toHaveText(
      "AI (for Ada) changed a block.",
    );
    await expect(
      gracePage.locator('[data-block-type="title"]').first(),
    ).toContainText("Hello there");
    await expect(adaPage.locator('[data-kind="aiEdited"]')).toHaveCount(0);
    await expect(
      ada.ai.title().locator('[data-testid="block-agent-highlight"]'),
    ).toBeVisible();
  });
});
