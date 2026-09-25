import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

const HERO_PROOFS = [
  "example-flowwork-newsletter",
  "example-sable-friday",
  "example-launchpad-launch",
];

test.describe("Setup catalog", () => {
  test("leads with the headline and the Minimum call to action", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await expect(page.locator(SELECTORS.catalogScreen)).toBeVisible();
    await expect(page.locator("h1")).toHaveText(
      "The email editor you drop into your app.",
    );
    await expect(page.getByTestId("scene-link-minimum")).toHaveText(
      "Run these lines",
    );
    const firstLink = page.locator("[data-testid^='scene-link-']").first();
    await expect(firstLink).toHaveAttribute(
      "data-testid",
      "scene-link-minimum",
    );
  });

  test("Minimum call to action opens the minimum scene host", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await page.locator('[data-testid="scene-link-minimum"]').click();
    await expect(page.locator(SELECTORS.sceneHost)).toBeVisible();
    await expect(page).toHaveURL(/\/scenes\/minimum/);
    await editorPage.waitForReady();
  });

  test("every setup group is visible at once, with no tabs", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await expect(page.locator('[role="tablist"]')).toHaveCount(0);
    for (const id of [
      "theming",
      "merge-tags",
      "saved-blocks",
      "import-unlayer",
      "example-northstage-ar",
    ]) {
      await expect(page.getByTestId(`scene-link-${id}`)).toBeAttached();
    }
    // Every registered scene, read from the generated /llms.txt (the scene
    // registry's own index), so a new scene needs no edit here.
    const llms = await (await page.request.get("/llms.txt")).text();
    const registered = [
      ...llms.matchAll(
        /\(https:\/\/play\.templatical\.com\/scenes\/([a-z0-9-]+)\)/g,
      ),
    ].map((match) => `scene-link-${match[1]}`);
    expect(registered.length).toBeGreaterThan(30);
    const listed = await page
      .locator("[data-testid^='scene-link-']")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
    expect(new Set(listed)).toEqual(new Set(registered));
  });

  test("the hero fans three finished emails that open their scenes", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    const hero = page.getByTestId("catalog-proofs");
    const cards = hero.locator("[data-testid^='hero-proof-']");
    await expect(cards).toHaveCount(3);
    expect(
      await cards.evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-testid")),
      ),
    ).toEqual(HERO_PROOFS.map((id) => `hero-proof-${id}`));
    // Real captured emails, not wireframes: every image decoded at 600px.
    await expect
      .poll(() =>
        hero
          .locator("img")
          .evaluateAll((imgs) =>
            imgs.map((img) => (img as HTMLImageElement).naturalWidth),
          ),
      )
      .toEqual([600, 600, 600]);
    await page.getByTestId("hero-proof-example-sable-friday").click();
    await expect(page).toHaveURL(/\/scenes\/example-sable-friday/);
    await editorPage.waitForReady();
  });

  test("example tiles show captured proofs and open their scene", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    const card = page.getByTestId("scene-link-example-launchpad-launch");
    const proof = card.getByTestId("catalog-proof");
    await card.scrollIntoViewIfNeeded();
    await expect(proof).toHaveAttribute(
      "src",
      "/examples/proofs/example-launchpad-launch.webp",
    );
    await expect
      .poll(() =>
        proof.evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBe(600);
    await card.click();
    await expect(page.locator(SELECTORS.sceneHost)).toBeVisible();
    await expect(page).toHaveURL(/\/scenes\/example-launchpad-launch/);
    await editorPage.waitForReady();
  });

  test("copies the install command", async ({ chooserPage, page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await chooserPage.goto();
    await page.getByTestId("catalog-install-copy").click();
    await expect(page.getByTestId("catalog-setup")).toContainText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npm i @templatical/editor",
    );
  });

  test("shows the minimal setup and copies exactly what it shows", async ({
    chooserPage,
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await chooserPage.goto();
    const shown = await page.getByTestId("catalog-snippet").textContent();
    expect(shown).toContain('import { init } from "@templatical/editor";');
    expect(shown).toContain("const editor = await init({");
    await page.getByTestId("catalog-snippet-copy").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      shown,
    );
  });

  test("Back from a scene lands on that scene's group", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await page.getByTestId("scene-link-saved-blocks").click();
    await editorPage.waitForReady();
    await page.getByTestId("toolbar-back").click();
    await expect(page.locator(SELECTORS.catalogScreen)).toBeVisible();
    await expect(page).toHaveURL(/#group-backend$/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getElementById("group-backend")!.getBoundingClientRect()
              .top,
        ),
      )
      .toBeLessThan(80);
  });

  test("highlights the setup code exactly like the Code dialog", async ({
    chooserPage,
    page,
  }) => {
    const importColor = () =>
      page
        .getByTestId("catalog-snippet")
        .locator("span", { hasText: /^import$/ })
        .first()
        .evaluate((el) => getComputedStyle(el).color);
    await chooserPage.goto();
    // CodeMirror's defaultHighlightStyle keyword colour (#708).
    await expect.poll(importColor).toBe("rgb(119, 0, 136)");
    await page.getByTestId("toolbar-theme").click(); // auto → light
    await page.getByTestId("toolbar-theme").click(); // light → dark
    // One Dark's keyword colour (#c678dd).
    await expect.poll(importColor).toBe("rgb(198, 120, 221)");
  });

  test("does not link to the Cloud playground, which stays reachable by URL", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await expect(page.locator('a[href="#cloud"]')).toHaveCount(0);
    await page.goto("/#cloud");
    await expect(page.locator("#cloud-client-id")).toBeVisible();
  });

  test("has no Shadow DOM toggle on either header", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await expect(page.getByTestId("toolbar-shadow-toggle")).toHaveCount(0);
    await page.getByTestId("scene-link-minimum").click();
    await editorPage.waitForReady();
    await expect(page.getByTestId("toolbar-shadow-toggle")).toHaveCount(0);
  });

  test("a stored light-DOM choice no longer strands the visitor", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-shadow-mode", "light");
      localStorage.setItem("tpl-playground-host-tour-dismissed", "true");
    });
    await page.goto("/scenes/minimum");
    await page.waitForSelector(
      '[data-testid="scene-host"][data-scene-ready="true"]',
    );
    expect(
      await page
        .getByTestId("editor-container")
        .evaluate((el) => el.shadowRoot !== null),
    ).toBe(true);
  });

  test("does not scroll sideways on a phone", async ({ chooserPage, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await chooserPage.goto();
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.scroll).toBe(widths.viewport);
  });

  test("dark-mode group marks keep their hue", async ({
    chooserPage,
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-theme", "dark");
    });
    await chooserPage.goto();
    // Mixing `in oklch` toward the dark ground takes the short way round the
    // hue wheel and paints the amber marks purple (hue ~295); they mix in oklab.
    const hue = await page
      .locator('.pg-group-mark[data-group="configure"]')
      .evaluate((el) => {
        // The computed value is serialised in its mixing space (oklab), so
        // paint it to a pixel to read sRGB regardless of the format.
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = getComputedStyle(el).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        // sRGB → hue in degrees; enough to tell amber from purple.
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        if (d === 0) return 0;
        const h =
          max === r
            ? ((g - b) / d) % 6
            : max === g
              ? (b - r) / d + 2
              : (r - g) / d + 4;
        return (h * 60 + 360) % 360;
      });
    expect(hue).toBeGreaterThan(10);
    expect(hue).toBeLessThan(60);
  });
});
