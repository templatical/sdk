import { test, expect } from "../fixtures/editor.fixture";

const RAIL = '[data-testid="catalog-rail"]';
const READY = '[data-testid="scene-host"][data-scene-ready="true"]';
const GROUPS = [
  "configure",
  "personalization",
  "backend",
  "import",
  "examples",
] as const;

test.describe("Scene rail", () => {
  test("opens the current scene's group only, and each row shows its init() key", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("theming");
    const rail = page.locator(RAIL);

    await expect(rail.getByTestId("catalog-tab-configure")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    for (const group of GROUPS.slice(1)) {
      await expect(rail.getByTestId(`catalog-tab-${group}`)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
    const theming = rail.getByTestId("rail-scene-theming");
    await expect(theming).toHaveAttribute("aria-current", "page");
    await expect(theming.locator("code")).toHaveText("theme");
    await expect(
      rail.getByTestId("rail-scene-shadow-dom-off").locator("code"),
    ).toHaveText("shadowDom: false");
    await expect(rail.getByTestId("rail-scene-merge-tags")).toBeHidden();
  });

  test("Minimum is a row of its own, not a heading over one row", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("fonts");
    await expect(page.getByTestId("catalog-tab-minimum")).toHaveCount(0);
    const row = page.getByTestId("rail-scene-minimum");
    await expect(row).toBeVisible();
    await expect(row.locator("code")).toHaveText("init({ container })");
  });

  test("a heading opens its group and closes the open one; a second click closes it", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("fonts");
    const configure = page.getByTestId("catalog-tab-configure");
    const personalization = page.getByTestId("catalog-tab-personalization");

    await personalization.click();
    await expect(personalization).toHaveAttribute("aria-expanded", "true");
    await expect(configure).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("rail-scene-merge-tags")).toBeVisible();
    await expect(page.getByTestId("rail-scene-fonts")).toBeHidden();

    await personalization.click();
    await expect(personalization).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("rail-scene-merge-tags")).toBeHidden();
  });

  test("a closed group's rows leave the tab order", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("fonts");
    const configure = page.getByTestId("catalog-tab-configure");

    await configure.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("rail-scene-fonts")).toBeFocused();

    await configure.focus();
    await page.keyboard.press("Enter");
    await expect(configure).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("rail-scene-fonts")).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("catalog-tab-personalization")).toBeFocused();
  });

  test("groups animate open and shut, and reduced motion turns that off", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("fonts");
    const panel = page.locator("#rail-panel-personalization").locator("../..");
    const motion = () =>
      panel.evaluate((el) => {
        const style = getComputedStyle(el);
        return `${style.transitionProperty} ${style.transitionDuration}`;
      });

    expect(await motion()).toBe("grid-template-rows, visibility 0.24s, 0s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await motion()).toBe("none 0s");
  });

  test.describe("at 900px tall", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("fits without scrolling, whichever group is open", async ({
      scenePage,
      page,
    }) => {
      // Reduced motion makes each group's height final the moment it opens.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await scenePage.goto("fonts");
      const rail = page.locator(RAIL);

      for (const group of GROUPS) {
        const heading = rail.getByTestId(`catalog-tab-${group}`);
        if ((await heading.getAttribute("aria-expanded")) !== "true") {
          await heading.click();
        }
        await expect(heading).toHaveAttribute("aria-expanded", "true");
        const overflow = await rail.evaluate(
          (el) => el.scrollHeight - el.clientHeight,
        );
        expect(overflow, group).toBeLessThanOrEqual(0);
      }
    });
  });

  test("the header button hides the rail, gives the editor its width, and is remembered", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("fonts");
    const toggle = page.getByTestId("toolbar-rail");
    const rail = page.locator(RAIL);
    const stage = page.getByTestId("editor-stage");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("title", "Hide setups");
    const railWidth = (await rail.boundingBox())!.width;
    const stageWidth = (await stage.boundingBox())!.width;

    await toggle.click();
    await expect(rail).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("title", "Show setups");
    await expect
      .poll(async () => (await stage.boundingBox())!.width)
      .toBeCloseTo(stageWidth + railWidth, 0);

    await page.reload();
    await page.locator(READY).waitFor();
    await expect(rail).toBeHidden();

    await toggle.click();
    await expect(rail).toBeVisible();
    await page.reload();
    await page.locator(READY).waitFor();
    await expect(rail).toBeVisible();
  });

  test("previous and next walk the registry across groups", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("custom-blocks");
    const next = page.getByTestId("scene-next");
    await expect(next).toHaveAttribute("aria-label", "Next: Merge tags");
    await expect(next).toHaveAttribute("title", "Next: Merge tags");

    await next.click();
    await expect(page).toHaveURL(/\/scenes\/merge-tags\?shadowDom=[01]$/);
    await page.locator(READY).waitFor();
    await expect(page.getByTestId("scene-header").locator("h1")).toHaveText(
      "Merge tags",
    );
    await expect(
      page.getByTestId("catalog-tab-personalization"),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("scene-previous")).toHaveAttribute(
      "aria-label",
      "Previous: Custom blocks",
    );
  });

  test("the arrows stop at the first and last scene", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("minimum");
    const previous = page.getByTestId("scene-previous");
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    await expect(previous).not.toHaveAttribute("href");
    await expect(previous).toHaveAttribute("aria-label", "No previous scene");

    await scenePage.goto("example-northstage-ar");
    const next = page.getByTestId("scene-next");
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(next).not.toHaveAttribute("href");
    await expect(page.getByTestId("scene-previous")).toHaveAttribute(
      "aria-label",
      "Previous: Northstage event",
    );
  });

  test("the arrows stay put when the title changes length", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("defaults");
    const next = page.getByTestId("scene-next");
    const before = (await next.boundingBox())!.x;

    // Defaults → Theming → Layout → Internationalization, a much longer
    // title. Waiting on the title each step means the next click lands on
    // the re-rendered arrow, not the previous scene's.
    for (const title of ["Theming", "Layout", "Internationalization"]) {
      await next.click();
      await expect(page.getByTestId("scene-header").locator("h1")).toHaveText(
        title,
      );
    }
    await page.locator(READY).waitFor();
    expect((await next.boundingBox())!.x).toBe(before);
  });
});
