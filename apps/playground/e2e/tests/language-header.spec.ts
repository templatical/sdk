import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/editor.fixture";

const harness = fileURLToPath(
  new URL("../helpers/localization-header.ts", import.meta.url),
);

for (const editorWidth of [530, 768]) {
  test(`all header controls remain clickable in a ${editorWidth}px editor in both language views`, async ({
    page,
    scenePage,
    shadowDom,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await scenePage.goto("minimum");
    await page.evaluate(
      async ({ url, shadow, width }) => {
        const { mountCrowdedHeader } = await import(/* @vite-ignore */ url);
        await mountCrowdedHeader(shadow, width);
      },
      { url: `/@fs${harness}`, shadow: shadowDom, width: editorWidth },
    );
    const host = page.getByTestId("language-header-harness");
    const header = host.locator("header");
    for (const language of ["en", "zh-Hant-HK"]) {
      if (language !== "en") {
        await host.getByTestId("language-menu").click();
        await host.getByTestId(`language-option-${language}`).click();
      }
      const controls = header.locator("button:visible:enabled");
      expect(await controls.count()).toBeGreaterThan(8);
      for (const control of await controls.all()) {
        await control.click({ trial: true });
        await control.focus();
      }
      expect(
        await host.locator(".tpl").evaluate((element) => ({
          left: element.scrollLeft,
          overflow: element.scrollWidth > element.clientWidth,
        })),
      ).toEqual({ left: 0, overflow: false });
    }
  });
}

test("the compact header at 1280 × 720 shows the whole template name", async ({
  page,
  scenePage,
  editorPage,
}) => {
  await scenePage.goto("languages");
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  const root = page.locator(".tpl").first();
  // The playground's editor is 1024px wide here, inside the compact query.
  expect(
    await root
      .locator(".tpl-header-container")
      .evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(1024);
  const name = root.getByTestId("template-name");
  await expect(name).toHaveText("Languages");
  expect(
    await name.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});

test("the 768px Languages scene keeps its code label clear of Docs and its editor unscrolled", async ({
  page,
  scenePage,
  editorPage,
}) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await scenePage.goto("languages");
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  const key = await page.getByTestId("scene-init-key").boundingBox();
  const docs = await page.getByTestId("toolbar-docs").boundingBox();
  expect(key!.x + key!.width).toBeLessThanOrEqual(docs!.x);
  const root = page.locator(".tpl").first();
  for (const language of ["en", "de"]) {
    if (language === "de") {
      await root.getByTestId("language-menu").click();
      await root.getByTestId("language-option-de").click();
    }
    for (const control of await root
      .locator("header button:visible:enabled")
      .all()) {
      await control.click({ trial: true });
      await control.focus();
    }
    expect(
      await root.evaluate((element) => ({
        left: element.scrollLeft,
        overflow: element.scrollWidth > element.clientWidth,
      })),
    ).toEqual({ left: 0, overflow: false });
  }
});

for (const width of [1440, 1920]) {
  for (const rootFontSize of [8, 16]) {
    test(`a long language name keeps every header control reachable at ${width}px with a ${rootFontSize}px host root`, async ({
      page,
      scenePage,
      shadowDom,
    }) => {
      const vueWarnings: string[] = [];
      page.on("console", (message) => {
        if (message.text().includes("[Vue warn]")) {
          vueWarnings.push(message.text());
        }
      });
      try {
        await page.setViewportSize({ width, height: 800 });
        await scenePage.goto("minimum");
        await page.evaluate(
          async ({ url, shadow, fontSize }) => {
            document.documentElement.style.fontSize = `${fontSize}px`;
            const { mountCrowdedHeader } = await import(/* @vite-ignore */ url);
            await mountCrowdedHeader(shadow);
          },
          { url: `/@fs${harness}`, shadow: shadowDom, fontSize: rootFontSize },
        );
        const header = page.getByTestId("language-header-harness");
        for (const id of [
          "version-history",
          "collaborator-bar",
          "comments-trigger",
          "ai-menu-trigger",
          "test-email-trigger",
          "template-save",
        ]) {
          await expect(header.getByTestId(id)).toBeVisible();
        }
        const centre = header.locator(".tpl-header-center");
        const before = await centre.boundingBox();
        const menu = header.getByTestId("language-menu");
        expect(
          await menu.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              baseSize: parseFloat(style.getPropertyValue("--tpl-base-size")),
              maxWidth: parseFloat(style.maxWidth),
            };
          }),
        ).toEqual({ baseSize: 16, maxWidth: 144 });
        await menu.click();
        await header.getByTestId("language-option-zh-Hant-HK").click();
        await expect(menu).toContainText("中文");
        expect(await centre.boundingBox()).toEqual(before);
        const left = await header.locator(".tpl-header-left").boundingBox();
        const button = await menu.boundingBox();
        expect(button!.width).toBeLessThanOrEqual(144);
        expect(button!.x + button!.width).toBeLessThanOrEqual(
          left!.x + left!.width,
        );
        // Playwright's actionability check detects a neighbouring control stealing the click.
        const preview = header.locator(".tpl-preview-toggle");
        await preview.click();
        await expect(preview).toHaveAttribute("aria-pressed", "true");
        await menu.click();
        await expect(header.getByTestId("language-option-de")).toBeVisible();
        await expect(header.getByTestId("language-option-en")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await expect(header.getByRole("menu")).toHaveCount(0);
        await expect(menu).toBeFocused();
      } finally {
        expect(
          vueWarnings,
          "page console must contain no Vue warnings",
        ).toEqual([]);
      }
    });
  }
}
