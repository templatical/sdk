import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

const AURORA = '[data-testid="hero-aurora"]';

test.describe("Hero aurora", () => {
  test("the home page hero has it; a scene never does", async ({
    chooserPage,
    scenePage,
    page,
  }) => {
    await chooserPage.goto();
    await expect(page.locator(AURORA)).toHaveCount(1);
    await scenePage.goto("minimum");
    await expect(page.locator(SELECTORS.editorStage)).toBeVisible();
    await expect(page.locator(AURORA)).toHaveCount(0);
  });

  test("it sits behind the hero's text, above the page", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const aurora = page.locator(AURORA);
    expect(await aurora.evaluate((el) => getComputedStyle(el).zIndex)).toBe(
      "-1",
    );
    // An isolated parent keeps -1 above the page's own background.
    expect(
      await aurora.evaluate(
        (el) => getComputedStyle(el.parentElement!).isolation,
      ),
    ).toBe("isolate");
    // Only the header and hero: the setup list starts below it.
    const bottom = (await aurora.boundingBox())!;
    // The section, not its heading: the heading is sr-only, whose -1px
    // margin puts it a pixel above the section's edge.
    const setups = (await page
      .locator('section[aria-labelledby="catalog-setups"]')
      .boundingBox())!;
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(setups.y);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: it fades into the page's own paper`, async ({
      chooserPage,
      page,
    }) => {
      await page.addInitScript((t) => {
        localStorage.setItem("tpl-playground-theme", t);
      }, theme);
      await chooserPage.goto();
      const paper = await page
        .getByTestId("catalog-screen")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      const fade = await page
        .locator(`${AURORA} .pg-hero-aurora-fade`)
        .evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(fade.endsWith(`${paper})`)).toBe(true);
    });
  }

  test("without WebGL2 it paints the gradient fallback and never runs", async ({
    chooserPage,
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type === "webgl2") return null;
        return (original as (...args: unknown[]) => unknown).call(
          this,
          type,
          ...rest,
        );
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await chooserPage.goto();
    const aurora = page.locator(AURORA);
    await expect(aurora).toHaveAttribute("data-renderer", "fallback");
    await expect(aurora).toHaveAttribute("data-running", "false");
    await expect(aurora.locator(".pg-hero-aurora-fallback")).toHaveCount(1);
  });

  test("it drifts for a stretch after the pointer moves, then holds still", async ({
    chooserPage,
    page,
  }) => {
    // Real time: a fake clock installed before navigation stalls the app's
    // own boot. The stretch is AURORA_IDLE_MS, 6s.
    await chooserPage.goto();
    const aurora = page.locator(AURORA);
    test.skip(
      (await aurora.getAttribute("data-renderer")) !== "webgl2",
      "this browser has no WebGL2",
    );
    await expect(aurora).toHaveAttribute("data-running", "true");
    await expect(aurora).toHaveAttribute("data-running", "false", {
      timeout: 12_000,
    });
    await page.mouse.move(400, 300);
    await expect(aurora).toHaveAttribute("data-running", "true");
  });

  test("reduced motion paints one frame and never drifts", async ({
    chooserPage,
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await chooserPage.goto();
    const aurora = page.locator(AURORA);
    await expect(aurora).toHaveAttribute("data-running", "false");
    await page.mouse.move(400, 300);
    await expect(aurora).toHaveAttribute("data-running", "false");
  });
});
