import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

const SHARED_CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    linkUnderline: true,
    fontFamily: "Arial",
    locale: "en",
    preheaderText: "Shared playground payload",
  },
  blocks: [],
};

test.describe("share load", () => {
  test("?s= restores the recorded scene and content", async ({
    page,
    shadowDom,
  }) => {
    await page.route("**/api/shares/abc123", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "abc123",
          sceneId: "minimum",
          content: SHARED_CONTENT,
          createdAt: "2026-09-21T00:00:00.000Z",
        }),
      });
    });

    const qs = new URLSearchParams({
      s: "abc123",
      shadowDom: shadowDom ? "1" : "0",
    });
    await page.goto(`/?${qs.toString()}`);
    await expect(page).toHaveURL(/\/scenes\/minimum/);
    await page.waitForSelector(
      '[data-testid="scene-host"][data-scene-ready="true"]',
    );
    const mjml = await page.evaluate(() =>
      (
        window as unknown as { __tplPlaygroundGetMjml: () => Promise<string> }
      ).__tplPlaygroundGetMjml(),
    );
    expect(mjml).toContain("Shared playground payload");
  });

  test("expired share shows recovery on the catalog URL", async ({
    page,
    shadowDom,
  }) => {
    await page.route("**/api/shares/expired1", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Share not found" }),
      });
    });

    const qs = new URLSearchParams({
      s: "expired1",
      shadowDom: shadowDom ? "1" : "0",
    });
    await page.goto(`/?${qs.toString()}`);
    await expect(
      page.locator('[data-testid="share-load-error"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to Playground" }),
    ).toHaveAttribute("href", "/");
    await expect(page.locator(SELECTORS.catalogScreen)).toHaveCount(0);
  });
});
