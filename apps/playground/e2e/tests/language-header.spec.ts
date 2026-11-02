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
    await expect(header).toHaveAttribute("data-compact", "true");
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

test("the Languages header keeps its template name within its measured track", async ({
  page,
  scenePage,
  editorPage,
}) => {
  await scenePage.goto("languages");
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  const root = page.locator(".tpl").first();
  const header = root.locator(".tpl-header");
  await expect
    .poll(async () => Number(await header.getAttribute("data-full-width")))
    .toBeGreaterThan(0);
  const required = Number(await header.getAttribute("data-full-width"));
  const available = (await header.boundingBox())!.width;
  await expect(header).toHaveAttribute(
    "data-compact",
    String(available < required),
  );
  const name = root.getByTestId("template-name");
  await expect(name).toHaveText("Languages");
  expect(
    await name.evaluate((element) => {
      const identity = element.closest(".tpl-header-identity")!;
      return (
        element.getBoundingClientRect().right <=
        identity.getBoundingClientRect().right
      );
    }),
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
        const chrome = header.locator(".tpl-header");
        await expect
          .poll(async () =>
            Number(await chrome.getAttribute("data-full-width")),
          )
          .toBeGreaterThan(0);
        const required = Number(await chrome.getAttribute("data-full-width"));
        // This case checks full-mode centring. Choose room from the measured
        // controls rather than assuming a viewport guarantees that mode.
        const fullWidth = Math.max(width, Math.ceil(required) + 300);
        await page.setViewportSize({ width: fullWidth, height: 800 });
        await header.evaluate((element, needed) => {
          (element as HTMLElement).style.width = `${needed}px`;
        }, fullWidth);
        await expect(chrome).toHaveAttribute("data-compact", "false");
        const centre = header.locator(".tpl-header-center");
        const before = await centre.boundingBox();
        const menu = header.getByTestId("language-menu");
        expect(
          await menu.evaluate((element) =>
            parseFloat(
              getComputedStyle(element).getPropertyValue("--tpl-base-size"),
            ),
          ),
        ).toBe(16);
        await menu.click();
        await header.getByTestId("language-option-zh-Hant-HK").click();
        await expect(menu).toContainText("中文");
        await expect(chrome).toHaveAttribute("data-compact", "false");
        await expect(menu.locator(".tpl-language-count")).toBeVisible();
        await expect(menu.locator(".tpl-language-count")).toHaveText("1");
        for (const label of await menu
          .locator(".tpl-language-name, .tpl-language-count")
          .all()) {
          expect(
            await label.evaluate(
              (element) => element.scrollWidth <= element.clientWidth,
            ),
          ).toBe(true);
        }
        expect(await centre.boundingBox()).toEqual(before);
        const left = await header.locator(".tpl-header-left").boundingBox();
        const button = await menu.boundingBox();
        expect(button!.width).toBeGreaterThan(144);
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

test("the fullest header compacts only below its measured full-label requirement", async ({
  page,
  scenePage,
  shadowDom,
}) => {
  await page.setViewportSize({ width: 2560, height: 900 });
  await scenePage.goto("minimum");
  await page.evaluate(
    async ({ url, shadow }) => {
      const { mountCrowdedHeader } = await import(/* @vite-ignore */ url);
      await mountCrowdedHeader(shadow, 2200);
    },
    { url: `/@fs${harness}`, shadow: shadowDom },
  );
  const host = page.getByTestId("language-header-harness");
  const header = host.locator(".tpl-header");
  for (const id of [
    "language-menu",
    "version-history",
    "collaborator-bar",
    "comments-trigger",
    "ai-menu-trigger",
    "test-email-trigger",
    "template-save",
  ]) {
    await expect(host.getByTestId(id)).toBeVisible();
  }
  const setWidth = async (width: number) => {
    await host.evaluate((element, value) => {
      (element as HTMLElement).style.width = `${value}px`;
    }, width);
  };
  for (const language of ["en", "zh-Hant-HK"]) {
    if (language !== "en") {
      await host.getByTestId("language-menu").click();
      await host.getByTestId(`language-option-${language}`).click();
    }
    await expect
      .poll(async () => Number(await header.getAttribute("data-full-width")))
      .toBeGreaterThan(0);
    const required = Number(await header.getAttribute("data-full-width"));
    await setWidth(Math.ceil(required));
    await expect(header).toHaveAttribute("data-compact", "false");
    await expect(host.locator(".tpl-language-name")).toBeVisible();
    const left = (await host.locator(".tpl-header-left").boundingBox())!;
    const centre = (await host.locator(".tpl-header-center").boundingBox())!;
    const right = (await host.locator(".tpl-header-right").boundingBox())!;
    expect(left.x + left.width).toBeLessThanOrEqual(centre.x + 0.5);
    expect(centre.x + centre.width).toBeLessThanOrEqual(right.x + 0.5);
    for (const control of await host
      .locator(".tpl-header-left > *:visible")
      .all()) {
      const box = (await control.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(centre.x + 0.5);
    }
    for (const control of await host
      .locator(".tpl-header-right > *:visible")
      .all()) {
      expect((await control.boundingBox())!.x).toBeGreaterThanOrEqual(
        centre.x + centre.width - 0.5,
      );
    }
    await setWidth(Math.floor(required) - 1);
    await expect(header).toHaveAttribute("data-compact", "true");
    await expect(host.locator(".tpl-language-tag")).toBeVisible();
    // A width that fits only compact controls must stay compact across
    // repeated resize observations, then expand exactly when full fits again.
    await setWidth(Math.floor(required) - 2);
    await expect(header).toHaveAttribute("data-compact", "true");
    await setWidth(Math.ceil(required));
    await expect(header).toHaveAttribute("data-compact", "false");
  }
});

test("a header with fewer features keeps full labels below the former 1024px breakpoint", async ({
  page,
  scenePage,
  shadowDom,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await scenePage.goto("minimum");
  await page.evaluate(
    async ({ url, shadow }) => {
      const { mountCrowdedHeader } = await import(/* @vite-ignore */ url);
      await mountCrowdedHeader(shadow, 800, "minimum");
    },
    { url: `/@fs${harness}`, shadow: shadowDom },
  );
  const host = page.getByTestId("language-header-harness");
  const header = host.locator(".tpl-header");
  await expect(header).toHaveAttribute("data-compact", "false");
  await expect(host.locator(".tpl-language-name")).toBeVisible();
  await expect(host.locator(".tpl-language-tag")).toBeHidden();
  for (const control of await header.locator("button:visible:enabled").all()) {
    await control.click({ trial: true });
  }
  const englishRequired = Number(await header.getAttribute("data-full-width"));
  expect(englishRequired).toBeLessThanOrEqual(800);
  await host.getByTestId("language-menu").click();
  await host.getByTestId("language-option-zh-Hant-HK").click();
  await expect
    .poll(async () => Number(await header.getAttribute("data-full-width")))
    .toBeGreaterThan(englishRequired);
  const longRequired = Number(await header.getAttribute("data-full-width"));
  await host.evaluate((element, width) => {
    (element as HTMLElement).style.width = `${Math.ceil(width)}px`;
  }, longRequired);
  await expect(header).toHaveAttribute("data-compact", "false");
  await expect(host.locator(".tpl-language-name")).toBeVisible();
  await expect(host.locator(".tpl-language-count")).toBeVisible();
  await expect(host.locator(".tpl-language-count")).toHaveText("1");
  for (const label of await host
    .locator(".tpl-language-name, .tpl-language-count")
    .all()) {
    expect(
      await label.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
});
