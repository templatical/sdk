import { test, expect } from "../fixtures/editor.fixture";
import type { TemplateContent } from "@templatical/types";

test("renders custom block text fields literally", async ({
  scenePage,
  editorPage,
  page,
}) => {
  const value = '<img src=x onerror="window.__tplXss=1">';
  const content = {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      linkUnderline: true,
      fontFamily: "Arial",
      locale: "en",
    },
    blocks: [{
      id: "escaped-testimonial",
      type: "custom",
      customType: "testimonial",
      fieldValues: { quote: "Quote", authorName: value },
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    }],
  } satisfies TemplateContent;
  await page.route("**/api/shares/custom-block-escaping", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "custom-block-escaping",
        sceneId: "custom-blocks",
        content,
        createdAt: "2026-10-30T00:00:00.000Z",
      }),
    }),
  );
  await scenePage.goto("custom-blocks", { s: "custom-block-escaping" });
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();

  const block = page.locator('[data-block-id="escaped-testimonial"]');
  await expect(block).toHaveText(`Quote — ${value}`);
  await expect(block.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() =>
    (window as { __tplXss?: number }).__tplXss,
  )).toBeUndefined();
});
