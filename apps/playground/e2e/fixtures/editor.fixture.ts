import { test as base } from "@playwright/test";
import { ChooserPage } from "../pages/chooser.page";
import { EditorPage } from "../pages/editor.page";

type EditorFixtures = {
  chooserPage: ChooserPage;
  editorPage: EditorPage;
  editorReady: { chooserPage: ChooserPage; editorPage: EditorPage };
  blankEditorReady: { chooserPage: ChooserPage; editorPage: EditorPage };
};

export const test = base.extend<EditorFixtures>({
  chooserPage: async ({ page }, use) => {
    await use(new ChooserPage(page));
  },
  editorPage: async ({ page }, use) => {
    await use(new EditorPage(page));
  },
  editorReady: async ({ page }, use) => {
    const chooserPage = new ChooserPage(page);
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
  blankEditorReady: async ({ page }, use) => {
    const chooserPage = new ChooserPage(page);
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
