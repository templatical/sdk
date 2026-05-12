import { test as base } from "@playwright/test";
import { ChooserPage } from "../pages/chooser.page";
import { EditorPage } from "../pages/editor.page";

type EditorFixtures = {
  /**
   * True when the active Playwright project mounts the editor inside a
   * Shadow DOM (`chromium-shadow`). Read from `project.metadata.shadowDom`
   * so specs can branch on the mode without touching the URL directly.
   */
  shadowDom: boolean;
  chooserPage: ChooserPage;
  editorPage: EditorPage;
  editorReady: { chooserPage: ChooserPage; editorPage: EditorPage };
  blankEditorReady: { chooserPage: ChooserPage; editorPage: EditorPage };
};

export const test = base.extend<EditorFixtures>({
  shadowDom: async ({}, use, testInfo) => {
    await use(Boolean(testInfo.project.metadata?.shadowDom));
  },
  chooserPage: async ({ page, shadowDom }, use) => {
    await use(new ChooserPage(page, { shadowDom }));
  },
  editorPage: async ({ page }, use) => {
    await use(new EditorPage(page));
  },
  editorReady: async ({ page, shadowDom }, use) => {
    const chooserPage = new ChooserPage(page, { shadowDom });
    const editorPage = new EditorPage(page);
    // Set localStorage BEFORE any page JS runs to prevent overlays
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await use({ chooserPage, editorPage });
  },
  blankEditorReady: async ({ page, shadowDom }, use) => {
    const chooserPage = new ChooserPage(page, { shadowDom });
    const editorPage = new EditorPage(page);
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectBlankTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await use({ chooserPage, editorPage });
  },
});

export { expect } from "@playwright/test";
