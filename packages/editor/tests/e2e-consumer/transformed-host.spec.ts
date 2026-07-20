import { test, expect } from "@playwright/test";

/**
 * Regression gate: editor popovers must stay anchored to their trigger when a
 * transformed ancestor of the editor becomes the containing block for
 * `position: fixed`.
 *
 * A consumer scroll-parallax wrapper / route-transition / reveal animation
 * puts a `transform` on an ancestor of the mount point — which becomes the
 * containing block for any `fixed` descendant and offsets it by the ancestor's
 * position. The color picker (and the rich-text toolbars + merge-tag popup)
 * teleport into the shadow popover root and previously positioned themselves
 * `fixed` with viewport coordinates, so they landed far from their trigger
 * (the marketing-site hero symptom). The fix anchors them `absolute` inside
 * the positioned popover root in root-local coordinates — see
 * `usePopoverPosition` — which cancels the ancestor offset.
 *
 * Reuses the vanilla-consumer fixture (built + packed editor, shadow-DOM
 * default). The fixture's `#editor` is `position: fixed; inset: 0` (origin
 * 0,0), so a bare transform wouldn't reveal an offset — `translate()` gives it
 * both the containing-block role and a non-zero origin, the exact bug shape.
 */
test.describe("transformed host — popover stays on its trigger", () => {
  test("color picker opens adjacent to its swatch under an ancestor transform", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { editor?: unknown }).editor === "object",
      null,
      { timeout: 30_000 },
    );

    // Turn the editor container into a transformed, viewport-offset containing
    // block — the condition that mislocated the `fixed` popover.
    await page.evaluate(() => {
      document.getElementById("editor")!.style.transform =
        "translate(140px, 90px)";
    });

    // Drive the editor via programmatic shadow-root clicks: the transform can
    // push the right-side Settings tab out of the viewport (which blocks
    // Playwright's actionable click), but the relative popover-vs-swatch
    // geometry we assert on is valid regardless of on-screen position.
    await page.evaluate(() => {
      const root = document.getElementById("editor")!.shadowRoot!;
      (
        root.querySelector('button[aria-label="Settings"]') as HTMLElement | null
      )?.click();
    });
    await page.waitForFunction(
      () =>
        !!document
          .getElementById("editor")!
          .shadowRoot!.querySelector('button[aria-label="Pick a color"]'),
      null,
      { timeout: 10_000 },
    );
    await page.evaluate(() => {
      const root = document.getElementById("editor")!.shadowRoot!;
      (
        root.querySelector('button[aria-label="Pick a color"]') as HTMLElement
      ).click();
    });
    await page.waitForFunction(
      () =>
        !!document
          .getElementById("editor")!
          .shadowRoot!.querySelector(".tpl-color-popover"),
      null,
      { timeout: 10_000 },
    );

    const geom = await page.evaluate(() => {
      const root = document.getElementById("editor")!.shadowRoot!;
      const openSwatch = root.querySelector('button[aria-expanded="true"]')!;
      const popover = root.querySelector(".tpl-color-popover")!;
      const s = openSwatch.getBoundingClientRect();
      const p = popover.getBoundingClientRect();
      return {
        dxLeft: Math.abs(p.left - s.left),
        gap: Math.min(Math.abs(p.top - s.bottom), Math.abs(s.top - p.bottom)),
      };
    });

    // Left-aligned with the swatch: the bug offset it by the 140px ancestor
    // translate, so a generous 24px tolerance still fails the old behavior.
    expect(geom.dxLeft).toBeLessThan(24);
    // Vertically adjacent (just below, or flipped just above) — not thrown
    // 90px down the page.
    expect(geom.gap).toBeLessThan(40);
  });
});
