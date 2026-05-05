import { expect, type Page } from "@playwright/test";
import { SELECTORS } from "../helpers/selectors";

type ImportSource = "beefree" | "unlayer" | "html";

const TRIGGER_BY_SOURCE: Record<ImportSource, string> = {
  beefree: SELECTORS.chooserImportBeefree,
  unlayer: SELECTORS.chooserImportUnlayer,
  html: SELECTORS.chooserImportHtml,
};

const TAB_BY_SOURCE: Record<ImportSource, string> = {
  beefree: SELECTORS.importTabBeefree,
  unlayer: SELECTORS.importTabUnlayer,
  html: SELECTORS.importTabHtml,
};

const TEXTAREA_BY_SOURCE: Record<ImportSource, string> = {
  beefree: SELECTORS.importTextareaBeefree,
  unlayer: SELECTORS.importTextareaUnlayer,
  html: SELECTORS.importTextareaHtml,
};

export class ChooserPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
    await this.page.waitForSelector(SELECTORS.chooserScreen);
  }

  async selectFirstTemplate() {
    const cards = this.page.locator(SELECTORS.templateCard);
    await cards.first().click();
  }

  async selectBlankTemplate() {
    await this.page.locator(SELECTORS.blankTemplateCard).click();
  }

  getTemplateCards() {
    return this.page.locator(SELECTORS.templateCard);
  }

  async openImportModal(source: ImportSource = "beefree") {
    await this.page.locator(TRIGGER_BY_SOURCE[source]).click();
    await expect(this.page.locator(SELECTORS.importModal)).toBeVisible();
  }

  getMigrationBand() {
    return this.page.locator(SELECTORS.chooserMigrationBand);
  }

  async selectImportSource(source: ImportSource) {
    const tab = TAB_BY_SOURCE[source];
    await this.page.locator(tab).click();
    await expect(this.page.locator(tab)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }

  async pasteImportJson(source: ImportSource, content: string) {
    await this.page.locator(TEXTAREA_BY_SOURCE[source]).fill(content);
  }

  async confirmImport() {
    await this.page.locator(SELECTORS.importConfirm).click();
  }

  getImportError() {
    return this.page.locator(SELECTORS.importError);
  }

  getImportModal() {
    return this.page.locator(SELECTORS.importModal);
  }

  /**
   * One-shot: open modal on the requested source, paste content, click Import.
   * Caller is responsible for asserting downstream editor state.
   */
  async importTemplate(source: ImportSource, content: string) {
    await this.openImportModal(source);
    await this.pasteImportJson(source, content);
    await this.confirmImport();
  }
}
