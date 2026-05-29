import { test, expect } from "@playwright/test";

/**
 * Proof-of-fix gate for issue #70 (host CSS bleeding into editor).
 *
 * Reuses the existing vanilla-consumer e2e setup (built + packed editor served
 * by vite — see `playwright.consumer.config.ts`) and injects a hostile host
 * stylesheet via `page.addInitScript()` so the CSS is present in `<head>`
 * before the editor mounts.
 *
 * With `shadowDom: true` as the default, host element-selector rules with
 * `!important` are blocked at the shadow boundary — editor chrome renders
 * with its bundled styles regardless of the host's CSS. This spec
 * exercises that contract by intentionally NOT passing `shadowDom` in the
 * vanilla-consumer fixture, so the SDK default is what gets verified.
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

  test("editor mounts with a shadow root carrying a non-empty adopted stylesheet", async ({
    page,
  }) => {
    // Foundation gate. If this fails, the shadow boundary isn't active at
    // all and none of the other assertions below would be meaningful — host
    // CSS would just reach editor elements normally.
    await page.goto("/");
    await page.waitForFunction(
      () => typeof (window as unknown as { editor?: unknown }).editor === "object",
      null,
      { timeout: 30_000 },
    );

    const shadowState = await page.evaluate(() => {
      const container = document.getElementById("editor");
      const root = container?.shadowRoot;
      return {
        hasShadowRoot: !!root,
        mode: root?.mode,
        adoptedSheetCount: root?.adoptedStyleSheets.length ?? 0,
        adoptedRuleCount: root
          ? Array.from(root.adoptedStyleSheets).reduce(
              (sum, sheet) => sum + sheet.cssRules.length,
              0,
            )
          : 0,
        hostileStylePresent: !!document.getElementById("hostile-host-css"),
      };
    });

    expect(shadowState.hostileStylePresent).toBe(true);
    expect(shadowState.hasShadowRoot).toBe(true);
    expect(shadowState.mode).toBe("open");
    expect(shadowState.adoptedSheetCount).toBeGreaterThan(0);
    // Bundled editor CSS has hundreds of rules. A near-empty sheet would
    // indicate the inline-style-css plugin's placeholder leaked again.
    expect(shadowState.adoptedRuleCount).toBeGreaterThan(100);
  });

  test("editor chrome resists host CSS bleed (font-family + border + box-sizing)", async ({
    page,
  }) => {
    // Targets three of the hostile rules at once:
    //  - `body * { font-family: Comic Sans MS !important; }`
    //  - `button { border: 5px solid lime !important; }`
    //  - `* { box-sizing: content-box !important; }`
    // Editor palette buttons are the most representative chrome surface —
    // sidebar emits one per block type, always visible post-mount.
    await page.goto("/");
    await page.waitForFunction(
      () => typeof (window as unknown as { editor?: unknown }).editor === "object",
      null,
      { timeout: 30_000 },
    );

    const editor = page.locator("#editor");
    const paletteButton = editor.locator("button[data-palette-type]").first();
    await expect(paletteButton).toBeVisible();

    const computed = await paletteButton.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        fontFamily: cs.fontFamily,
        borderColor: cs.borderColor,
        boxSizing: cs.boxSizing,
      };
    });

    expect(computed.fontFamily.toLowerCase()).not.toContain("comic sans");
    // Lime green = rgb(0, 255, 0) in any browser's color space.
    expect(computed.borderColor).not.toMatch(/rgb\(\s*0,\s*255,\s*0\s*\)/i);
    // Editor utilities rely on border-box layout math; content-box leak
    // would shift every padded element.
    expect(computed.boxSizing).toBe("border-box");
  });

  test("paragraph content resists host CSS bleed (color)", async ({ page }) => {
    // Guards `p { color: red !important; }`. The hostile rule targets every
    // `<p>` in the document — the editor renders text content into actual
    // `<p>` elements (TipTap output), so this is the literal reporter
    // scenario from issue #70.
    await page.goto("/");
    await page.waitForFunction(
      () => typeof (window as unknown as { editor?: unknown }).editor === "object",
      null,
      { timeout: 30_000 },
    );

    // Seed a paragraph block via setContent — exercises the canvas
    // rendering path that consumer-loaded templates hit.
    await page.evaluate(() => {
      const ed = (window as unknown as {
        editor: {
          getContent: () => { blocks: unknown[]; settings: unknown };
          setContent: (content: unknown) => void;
        };
      }).editor;
      const base = ed.getContent();
      ed.setContent({
        ...base,
        blocks: [
          ...base.blocks,
          {
            id: "p-aggressive",
            type: "paragraph",
            content: "<p>shadow-protected text</p>",
            styles: {
              padding: { top: 10, right: 10, bottom: 10, left: 10 },
            },
          },
        ],
      });
    });

    const paragraphP = page.locator('[data-block-type="paragraph"] p').first();
    await expect(paragraphP).toBeVisible();

    const color = await paragraphP.evaluate((el) => window.getComputedStyle(el).color);
    // rgb(255, 0, 0) is the hostile red. Any other value means the boundary
    // held.
    expect(color).not.toMatch(/rgb\(\s*255,\s*0,\s*0\s*\)/i);
  });

  test("title content resists host CSS bleed (color + font-weight)", async ({ page }) => {
    // Guards `h1, h2, h3 { color: hotpink !important; font-weight: 100 !important; }`.
    // Titles render as real `<h1>`–`<h4>` elements inside the canvas after
    // commit a911653-ish renderer change, so the hostile selector would
    // match in light DOM.
    await page.goto("/");
    await page.waitForFunction(
      () => typeof (window as unknown as { editor?: unknown }).editor === "object",
      null,
      { timeout: 30_000 },
    );

    await page.evaluate(() => {
      const ed = (window as unknown as {
        editor: {
          getContent: () => { blocks: unknown[]; settings: unknown };
          setContent: (content: unknown) => void;
        };
      }).editor;
      const base = ed.getContent();
      ed.setContent({
        ...base,
        blocks: [
          ...base.blocks,
          {
            id: "t-aggressive",
            type: "title",
            level: 1,
            content: "<p>shadow-protected heading</p>",
            styles: {
              padding: { top: 10, right: 10, bottom: 10, left: 10 },
            },
          },
        ],
      });
    });

    const titleHeading = page.locator('[data-block-type="title"] h1').first();
    await expect(titleHeading).toBeVisible();

    const computed = await titleHeading.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, fontWeight: cs.fontWeight };
    });

    // Hotpink = rgb(255, 105, 180).
    expect(computed.color).not.toMatch(/rgb\(\s*255,\s*105,\s*180\s*\)/i);
    // Weight 100 is the rule's value. Browsers report weight as a number
    // string; titles render in the editor's heading weight (600–700).
    expect(computed.fontWeight).not.toBe("100");
  });
});
