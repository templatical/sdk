import type { Page } from "@playwright/test";
import { SELECTORS } from "../helpers/selectors";

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
}
