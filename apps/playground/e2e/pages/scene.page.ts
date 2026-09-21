import type { Page } from "@playwright/test";

export class ScenePage {
  constructor(
    private page: Page,
    private options: { shadowDom?: boolean } = {},
  ) {}

  async goto(id: string, query: Record<string, string> = {}) {
    const params = new URLSearchParams(query);
    params.set("shadowDom", this.options.shadowDom ? "1" : "0");
    await this.page.goto(`/scenes/${id}?${params.toString()}`);
    await this.page.waitForSelector(
      '[data-testid="scene-host"][data-scene-ready="true"]',
    );
  }
}
