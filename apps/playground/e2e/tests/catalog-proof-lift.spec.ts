import { test, expect } from "../fixtures/editor.fixture";
import { freezeMotion, translateY } from "../helpers/motion";

// The glow is the only oklab shadow on the page: an amber color-mix.
const AMBER_GLOW = /^oklab\(0\.7 /;

test.describe("Home page proofs", () => {
  test("an example lifts with an amber glow, and glides there", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const link = page.getByTestId("scene-link-example-launchpad-launch");
    const tile = link.getByTestId("catalog-proof-tile");
    await tile.scrollIntoViewIfNeeded();
    expect(await tile.evaluate((el) => getComputedStyle(el).willChange)).toBe(
      "transform",
    );

    const resume = await freezeMotion(page);
    await link.hover();
    expect(await tile.evaluate(translateY)).toBe(0);
    await resume();
    await expect.poll(() => tile.evaluate(translateY)).toBe(-6);
    expect(await tile.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(
      AMBER_GLOW,
    );
  });

  test("reduced motion keeps the glow and drops the lift", async ({
    chooserPage,
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await chooserPage.goto();
    const link = page.getByTestId("scene-link-example-launchpad-launch");
    const tile = link.getByTestId("catalog-proof-tile");
    await tile.scrollIntoViewIfNeeded();
    await link.hover();
    await expect
      .poll(() => tile.evaluate((el) => getComputedStyle(el).boxShadow))
      .toMatch(AMBER_GLOW);
    expect(await tile.evaluate(translateY)).toBe(0);
  });

  test("a hero proof glows the same amber when it lifts", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    // The centre card of the fan.
    const proof = page.getByTestId("hero-proof-example-sable-friday");
    await proof.hover();
    await expect
      .poll(() => proof.evaluate((el) => getComputedStyle(el).boxShadow))
      .toMatch(AMBER_GLOW);
  });
});
