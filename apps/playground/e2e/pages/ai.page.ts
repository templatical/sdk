import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page } from "@playwright/test";
import type { TemplateContent } from "@templatical/types";
import { EditorPage } from "./editor.page";
import { SELECTORS } from "../helpers/selectors";

const png = () => ({
  name: "design.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
    "base64",
  ),
});

/** The AI surfaces, as a user reaches them. */
export class AiPage {
  constructor(private readonly page: Page) {}

  menu(): Locator {
    return this.page.locator('[data-testid="ai-menu-trigger"]');
  }

  async openPanel(panel: "chat"): Promise<void> {
    await this.menu().click();
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

  block(id: string): Locator {
    return this.page.locator(`[data-block-id="${id}"]`);
  }

  findingRows(ruleId: string): Locator {
    return new EditorPage(this.page).getIssueRow(ruleId);
  }

  async openIssues(): Promise<void> {
    await new EditorPage(this.page).openIssuesTab();
    await expect(
      this.page
        .locator(SELECTORS.rightPanelIssues)
        .getByRole("heading", { name: "Issues", exact: true }),
    ).toBeVisible();
  }

  /** Jump identifies the rule/block pair through the actual selected canvas block.
   * Selection opens Content, so return to Issues before the next action. */
  async findingTarget(ruleId: string, index: number): Promise<string> {
    await this.findingRows(ruleId).nth(index).getByTestId("issue-jump").click();
    const selected = this.page.locator(SELECTORS.blockSelected);
    await expect(selected).toHaveCount(1);
    const id = await selected.getAttribute("data-block-id");
    if (!id) throw new Error("Jump must select the finding's block");
    await this.openIssues();
    return id;
  }

  async expectFindings(ruleId: string, blockIds: string[]): Promise<void> {
    await this.openIssues();
    await expect(this.findingRows(ruleId)).toHaveCount(blockIds.length);
    const actual: string[] = [];
    for (let index = 0; index < blockIds.length; index++) {
      actual.push(await this.findingTarget(ruleId, index));
    }
    expect(actual).toEqual(blockIds);
  }

  async finding(ruleId: string, blockId: string): Promise<Locator> {
    const count = await this.findingRows(ruleId).count();
    for (let index = 0; index < count; index++) {
      if ((await this.findingTarget(ruleId, index)) === blockId) {
        return this.findingRows(ruleId).nth(index);
      }
    }
    throw new Error(`No finding ${ruleId} on ${blockId}`);
  }

  async undo(): Promise<void> {
    await new EditorPage(this.page).clickCanvasAwayFromSidebar();
    await this.page.keyboard.press("ControlOrMeta+z");
    await this.openIssues();
  }

  async attachPng(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: "Attach files", exact: true }),
    ).toBeVisible();
    await this.page.getByTestId("ai-chat-files").setInputFiles(png());
  }

  async dropPdf(): Promise<void> {
    const dataTransfer = await this.page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(
        new File(["%PDF-1.4\n%%EOF"], "design.pdf", {
          type: "application/pdf",
        }),
      );
      return data;
    });
    try {
      const panel = this.page.getByTestId("ai-panel-chat");
      await panel.dispatchEvent("dragenter", { dataTransfer });
      await panel.dispatchEvent("dragover", { dataTransfer });
      await expect(this.page.getByTestId("ai-chat-drop-hint")).toBeVisible();
      await panel.dispatchEvent("drop", { dataTransfer });
      await expect(this.page.getByTestId("ai-chat-drop-hint")).toHaveCount(0);
    } finally {
      await dataTransfer.dispose();
    }
  }

  async importPng(): Promise<void> {
    const chooser = this.page.waitForEvent("filechooser");
    await this.page.getByTestId("canvas-ai-import").click();
    await (await chooser).setFiles(png());
    await expect(this.page.getByTestId("ai-panel-chat")).toBeVisible();
  }

  /** Use the host's existing export flow, which reads editor.getContent(). */
  async content(): Promise<TemplateContent> {
    await new EditorPage(this.page).openExport();
    await this.page.locator(SELECTORS.exportTabJson).click();
    const downloaded = this.page.waitForEvent("download");
    await this.page.locator(SELECTORS.exportDownloadBtn).click();
    const file = await downloaded;
    const content = JSON.parse(
      await readFile((await file.path())!, "utf8"),
    ) as TemplateContent;
    await this.page.locator(SELECTORS.exportModalClose).click();
    return content;
  }
}
