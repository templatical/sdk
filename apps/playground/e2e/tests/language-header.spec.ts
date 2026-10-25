import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/editor.fixture";

const harness = fileURLToPath(
  new URL("../helpers/localization-header.ts", import.meta.url),
);

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
