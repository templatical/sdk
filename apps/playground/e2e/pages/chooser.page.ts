import { expect, type Page } from "@playwright/test";
import { SELECTORS } from "../helpers/selectors";

type ImportSource = "beefree" | "unlayer";

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
    const trigger =
      source === "beefree"
        ? SELECTORS.chooserImportBeefree
        : SELECTORS.chooserImportUnlayer;
    await this.page.locator(trigger).click();
    await expect(this.page.locator(SELECTORS.importModal)).toBeVisible();
  }

  getMigrationBand() {
    return this.page.locator(SELECTORS.chooserMigrationBand);
  }

  async selectImportSource(source: ImportSource) {
    const tab =
      source === "beefree"
        ? SELECTORS.importTabBeefree
        : SELECTORS.importTabUnlayer;
    await this.page.locator(tab).click();
    await expect(this.page.locator(tab)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }

  async pasteImportJson(source: ImportSource, json: string) {
    const textarea =
      source === "beefree"
        ? SELECTORS.importTextareaBeefree
        : SELECTORS.importTextareaUnlayer;
    await this.page.locator(textarea).fill(json);
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
   * One-shot: open modal directly on the requested source, paste JSON, click Import.
   * Caller is responsible for asserting downstream editor state.
   */
  async importTemplate(source: ImportSource, json: string) {
    await this.openImportModal(source);
    await this.pasteImportJson(source, json);
    await this.confirmImport();
  }
}
