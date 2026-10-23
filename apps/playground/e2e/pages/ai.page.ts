import { expect, type Locator, type Page } from "@playwright/test";

/** The AI surfaces, as a user reaches them. */
export class AiPage {
  constructor(private readonly page: Page) {}

  menu(): Locator {
    return this.page.locator('[data-testid="ai-menu-trigger"]');
  }

  async openPanel(panel: "chat"): Promise<void> {
    await this.menu().click();
    await this.page.locator(`[data-testid="ai-menu-item-${panel}"]`).click();
    await expect(
      this.page.locator(`[data-testid="ai-panel-${panel}"]`),
    ).toBeVisible();
  }

  async ask(message: string): Promise<void> {
    await this.page.locator('[data-testid="ai-chat-input"]').fill(message);
    await this.page.locator('[data-testid="ai-chat-send"]').click();
  }

  lastReply(): Locator {
    return this.page.locator('[data-testid="ai-chat-reply"]').last();
  }

  lastApplied(): Locator {
    return this.page.locator('[data-testid="ai-chat-applied"]').last();
  }

  lastUndo(): Locator {
    return this.page.locator('[data-testid="ai-chat-undo"]').last();
  }

  title(): Locator {
    return this.page.locator('[data-block-type="title"]').first();
  }
}
