import { test, expect } from "@playwright/test";

/**
 * Proof-of-fix gate for issue #70 (host CSS bleeding into editor).
 *
 * Reuses the existing vanilla-consumer e2e setup (built + packed editor served
 * by vite — see `playwright.consumer.config.ts`) and injects a hostile host
 * stylesheet via `page.addInitScript()` so the CSS is present in `<head>`
 * before the editor mounts.
 *
 * Current behavior (light DOM): host CSS cascades into the editor's chrome,
 * the assertions below fail, and `test.fail()` marks the run as
 * expected-failing.
 *
 * Target behavior (after Phase 7 default flip to `shadowDom: true`): host
 * CSS is blocked at the shadow boundary, assertions pass, and the
 * `test.fail()` annotation must be removed as part of the Phase 7 PR
 * (Playwright fails the run if a `test.fail()`-marked test actually passes).
 *
 * Removing `test.fail()` is therefore the explicit, mechanical signal that
 * #70 is fixed.
 */

const HOSTILE_CSS = `
  /* Element-level rules with !important — beat anything without !important
     regardless of specificity. This is the bug class consumers report. */
  body * { font-family: "Comic Sans MS" !important; }
  p { color: red !important; }
  h1, h2, h3 { color: hotpink !important; font-weight: 100 !important; }
  a { text-decoration: line-through !important; color: red !important; }
  button { border: 5px solid lime !important; }
  input, textarea, select { border: 5px solid magenta !important; }
  * { box-sizing: content-box !important; }
`;

test.describe("aggressive host CSS — issue #70 proof-of-fix gate", () => {
  test.beforeEach(async ({ page }) => {
    // Run before any script on the page — guarantees the hostile style is in
    // the document before editor mount logic runs.
    await page.addInitScript((css) => {
      const inject = () => {
        if (document.getElementById("hostile-host-css")) return;
        const style = document.createElement("style");
        style.id = "hostile-host-css";
        style.textContent = css;
        document.head.appendChild(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inject);
      } else {
        inject();
      }
    }, HOSTILE_CSS);
  });

  test("editor chrome resists host CSS bleed (font-family)", async ({ page }) => {
    // EXPECTED TO FAIL until Phase 7. Today the editor mounts in light DOM,
    // body's `* { font-family: Comic Sans MS !important }` hits every editor
    // descendant. Remove this annotation in the Phase 7 PR.
    test.fail(
      true,
      "Light DOM lets host CSS through. Phase 7 default flip to shadowDom: true should make this pass.",
    );

    await page.goto("/");
    await page.waitForFunction(
      () => typeof (window as unknown as { editor?: unknown }).editor === "object",
      null,
      { timeout: 30_000 },
    );

    // Sanity: hostile CSS actually landed.
    const hostileStylePresent = await page.evaluate(
      () => !!document.getElementById("hostile-host-css"),
    );
    expect(hostileStylePresent).toBe(true);

    // Any visible editor-rendered button — sidebar palette items always exist
    // post-mount. We pick the first one as a representative chrome element.
    const editor = page.locator("#editor");
    const paletteButton = editor.locator("button[data-palette-type]").first();
    await expect(paletteButton).toBeVisible();

    const computed = await paletteButton.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { fontFamily: cs.fontFamily, borderColor: cs.borderColor };
    });

    // Comic Sans MS bleed: the canonical reporter symptom.
    expect(computed.fontFamily.toLowerCase()).not.toContain("comic sans");

    // Lime green border on every button: the most visible chrome corruption.
    // rgb(0, 255, 0) in any browser's color space.
    expect(computed.borderColor).not.toMatch(/rgb\(\s*0,\s*255,\s*0\s*\)/i);
  });
});
