import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";

async function mountPreview(page: Page, shadowDom: boolean, scale = 1) {
  await page.evaluate(
    async ({ shadowDom, scale }) => {
      const runtimePath = "/src/host/useSceneInit.ts";
      const scenePath = "/src/scenes/author/languages.ts";
      const { mountScene } = await import(/* @vite-ignore */ runtimePath);
      const { languages } = await import(/* @vite-ignore */ scenePath);
      const ctx = { search: new URLSearchParams() };
      const content = languages.content(ctx);
      // A complete title keeps the same line height in either language. Block
      // chip geometry is covered separately from the space reserved for chrome.
      content.blocks = [content.blocks[0]];
      content.settings.locales = ["de"];
      delete content.settings.l10n;
      const container = document.createElement("div");
      container.id = "language-bar-preview";
      Object.assign(container.style, {
        position: "fixed",
        inset: "0",
        zIndex: "100000",
        width: `${100 / scale}%`,
        height: `${100 / scale}vh`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      });
      document.body.append(container);
      const editor = await mountScene(
        {
          ...languages,
          content: () => content,
          config: () => ({
            shadowDom,
            branding: false,
            localization: { locales: ["de"] },
            templates: {
              load: async (id: string) => ({ id, content }),
              create: false,
              save: false,
            },
            versionHistory: {
              list: async () => ({
                versions: [
                  { id: "v1", createdAt: "2026-10-28T12:00:00Z", content },
                ],
              }),
              get: async () => content,
              create: false,
              restore: false,
            },
            translation: {
              translate: async () => {
                throw new Error(
                  "Try again after the translation service finishes its scheduled maintenance. Your saved translations are available while the service is unavailable.",
                );
              },
            },
          }),
          open: async (instance: {
            load: (id: string) => Promise<unknown>;
          }) => {
            await instance.load("bar-preview");
          },
        },
        container,
        ctx,
      );
      (window as any).__languageBarCleanup = () => {
        editor.unmount();
        container.remove();
      };
    },
    { shadowDom, scale },
  );
}

async function sidebarControlsRemainUsable(host: Locator) {
  const chrome = host.locator(".tpl-top-chrome");
  for (const selector of [
    ".tpl-body",
    ".tpl-sidebar-rail",
    ".tpl-right-sidebar",
  ]) {
    await expect
      .poll(async () => {
        const stack = (await chrome.boundingBox())!;
        return (
          (await host.locator(selector).boundingBox())!.y -
          stack.y -
          stack.height
        );
      })
      .toBeCloseTo(0, 1);
  }
  const tabs = host.locator(".tpl-right-sidebar [role=tab]");
  await expect(tabs).toHaveCount(3);
  for (const name of ["content", "settings", "issues"]) {
    const tab = host.locator(`#tpl-tab-${name}`);
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
  const palette = host.locator(".tpl-sidebar-rail [data-palette-type]").first();
  await expect(palette).toBeVisible();
  const blocks = host.locator(".tpl-canvas [data-block-id]");
  const before = await blocks.count();
  await palette.click();
  await expect.poll(() => blocks.count()).toBeGreaterThan(before);
}

test("measures wrapped language and version bands without moving blocks inside the email", async ({
  page,
  scenePage,
  editorPage,
  shadowDom,
}) => {
  await scenePage.goto("languages");
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mountPreview(page, shadowDom);

  const host = page.locator("#language-bar-preview");
  const body = host.locator(".tpl-body");
  const header = host.locator(".tpl-header");
  const bar = host.getByTestId("language-bar");
  const relativeTitle = () =>
    host.locator('[data-block-id="languages-title"]').evaluate((block) => {
      const email = block.closest(".tpl-canvas")!;
      const outer = email.getBoundingClientRect();
      const inner = block.getBoundingClientRect();
      return {
        x: inner.x - outer.x,
        y: inner.y - outer.y,
        width: inner.width,
        height: inner.height,
      };
    });
  try {
    const before = await relativeTitle();
    const defaultTop = (await body.boundingBox())!.y;
    await host.getByTestId("language-menu").click();
    await host.getByTestId("language-option-de").click();
    await expect(bar).toBeVisible();
    await expect
      .poll(async () => (await body.boundingBox())!.y)
      .toBeCloseTo(
        (await bar.boundingBox())!.y + (await bar.boundingBox())!.height,
        1,
      );
    expect(await relativeTitle()).toEqual(before);
    expect((await body.boundingBox())!.y - defaultTop).toBeCloseTo(
      (await bar.boundingBox())!.height,
      1,
    );

    await sidebarControlsRemainUsable(host);

    await bar.getByTestId("translate-all-again").click();
    await host.getByTestId("translation-confirm").click();
    await expect(bar.getByTestId("translation-result")).toContainText(
      "The translation service said:",
    );
    const wideHeight = (await bar.boundingBox())!.height;
    await page.setViewportSize({ width: 768, height: 1000 });
    await expect
      .poll(async () => (await bar.boundingBox())!.height)
      .toBeGreaterThan(wideHeight);
    await expect
      .poll(async () => (await body.boundingBox())!.y)
      .toBeCloseTo(
        (await bar.boundingBox())!.y + (await bar.boundingBox())!.height,
        1,
      );

    await sidebarControlsRemainUsable(host);

    await host.getByTestId("version-history-toggle").click();
    await host.getByTestId("version-history-entry").click();
    const banner = host.getByTestId("version-preview-banner");
    await expect(banner).toBeVisible();
    await expect(bar).toBeVisible();
    await expect
      .poll(async () => (await bar.boundingBox())!.y)
      .toBeCloseTo(
        (await banner.boundingBox())!.y + (await banner.boundingBox())!.height,
        1,
      );
    await expect
      .poll(async () => (await body.boundingBox())!.y)
      .toBeCloseTo(
        (await bar.boundingBox())!.y + (await bar.boundingBox())!.height,
        1,
      );
    expect((await banner.boundingBox())!.y).toBeCloseTo(
      (await header.boundingBox())!.y + (await header.boundingBox())!.height,
      1,
    );

    await sidebarControlsRemainUsable(host);

    await host.getByTestId("version-preview-cancel").click();
    await bar.getByTestId("language-back-default").click();
    await expect(bar).toHaveCount(0);
    await expect
      .poll(async () => (await body.boundingBox())!.y)
      .toBeCloseTo(defaultTop, 1);
  } finally {
    await page.evaluate(() => (window as any).__languageBarCleanup?.());
  }
});

test("keeps the body below the top chrome in a host scaled to one half", async ({
  page,
  scenePage,
  editorPage,
  shadowDom,
}) => {
  await scenePage.goto("languages");
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mountPreview(page, shadowDom, 0.5);
  const host = page.locator("#language-bar-preview");
  const body = host.locator(".tpl-body");
  const chrome = host.locator(".tpl-top-chrome");
  const expectClearance = async () => {
    await expect
      .poll(async () => {
        const stack = (await chrome.boundingBox())!;
        return (await body.boundingBox())!.y - stack.y - stack.height;
      })
      .toBeCloseTo(0, 1);
    const stack = (await chrome.boundingBox())!;
    expect(stack.height).toBeGreaterThan(0);
    const layoutHeight = await chrome.evaluate(
      (element) => (element as HTMLElement).offsetHeight,
    );
    expect(stack.height).toBeCloseTo(layoutHeight * 0.5, 0);
  };
  try {
    await host.getByTestId("language-menu").click();
    await host.getByTestId("language-option-de").click();
    await expect(host.getByTestId("language-bar")).toBeVisible();
    await expectClearance();
    await host.getByTestId("version-history-toggle").click();
    await host.getByTestId("version-history-entry").click();
    await expect(host.getByTestId("version-preview-banner")).toBeVisible();
    await expect(host.getByTestId("language-bar")).toBeVisible();
    await expectClearance();
  } finally {
    await page.evaluate(() => (window as any).__languageBarCleanup?.());
  }
});
