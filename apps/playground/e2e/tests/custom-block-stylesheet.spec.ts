import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Browser-level coverage for `CustomBlockDefinition.stylesheet` (#155).
 *
 * Unit tests (renderer + editor composable + mount) prove the data path and
 * DOM presence in happy-dom. This file proves what happy-dom cannot: rules
 * actually apply in a real browser's CSS engine — shadow-root scoping,
 * computed-style cascade through inline + class rules, pseudo-class matching
 * (`:hover`), media-query firing on a real viewport, reactive cleanup when
 * the last instance of a custom-block type is removed, and the full export
 * path producing `<mj-style>` blocks in the rendered MJML.
 *
 * Fixture: the playground's `testimonialBlock` is a real responsive-layout
 * demo (table-based avatar | byline that stacks to single-column at ≤480px
 * via the new `stylesheet` field). The "Product Launch" template uses it and
 * promotes it in the "What's in this template" features modal, so loading
 * that template puts an instance on the canvas without any drag setup.
 */

/**
 * Read the textContent of every `<style data-tpl-custom-block-stylesheet>`
 * element found inside the editor root. The root auto-resolves to the
 * shadow root when one exists, the document otherwise — same surface either
 * way, so callers don't branch on mode.
 */
async function readStylesheetTextContents(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  return page.evaluate(() => {
    const container = document.querySelector(
      '[data-testid="editor-container"]',
    );
    const root: Document | ShadowRoot =
      (container?.shadowRoot as ShadowRoot | null) ?? document;
    const elements = Array.from(
      root.querySelectorAll<HTMLStyleElement>(
        "style[data-tpl-custom-block-stylesheet]",
      ),
    );
    return elements.map((el) => el.textContent ?? "");
  });
}

/**
 * Read computed style for an element matched by `selector` inside the editor
 * root. Returns `null` when the element is absent.
 */
async function readComputedStyle(
  page: import("@playwright/test").Page,
  selector: string,
  props: readonly string[],
): Promise<Record<string, string> | null> {
  return page.evaluate(
    ({ selector, props }) => {
      const container = document.querySelector(
        '[data-testid="editor-container"]',
      );
      const root: Document | ShadowRoot =
        (container?.shadowRoot as ShadowRoot | null) ?? document;
      const el = root.querySelector<HTMLElement>(selector);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of props) {
        out[p] = cs.getPropertyValue(p) || (cs as never)[p as never] || "";
      }
      return out;
    },
    { selector, props: [...props] },
  );
}

test.describe("Custom block stylesheet (#155)", () => {
  test.beforeEach(async ({ page }) => {
    // Suppress overlays so the editor reaches a stable state and the canvas
    // is laid out before we sample computed styles. Also hook
    // `navigator.clipboard.writeText` to capture the playground's copy-button
    // payload into a window variable — reading the OS clipboard directly
    // via `navigator.clipboard.readText()` is unreliable in headless
    // Chromium on Linux CI (no X11, plus the focus requirement is racy
    // under parallel workers). The playground's copy is driven by
    // VueUse's `useClipboard` which calls `writeText`; intercepting it
    // here gives us the exact string the user would have copied without
    // any OS-clipboard involvement.
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");

      // VueUse's `useClipboard` checks `clipboard-write` permission first.
      // In headless Chromium without `grantPermissions`, that permission is
      // denied → useClipboard falls back to its `legacyCopy` path:
      // creates a hidden `<textarea>`, selects its value, calls
      // `document.execCommand("copy")`. Hooking `execCommand("copy")` is
      // the most reliable interception point — works regardless of
      // permission state, no OS-clipboard involvement, no permission
      // ceremony in the test. At execCommand-call time the textarea's
      // value is in `getSelection().toString()`.
      (window as { __capturedClipboardWrite?: string }).__capturedClipboardWrite =
        "";
      const originalExec = document.execCommand.bind(document);
      document.execCommand = function (
        command: string,
        ...rest: unknown[]
      ): boolean {
        if (command === "copy") {
          const selected = document.getSelection()?.toString() ?? "";
          if (selected) {
            (
              window as { __capturedClipboardWrite?: string }
            ).__capturedClipboardWrite = selected;
          }
        }
        // The Function.prototype.apply signature accepts the rest as an
        // array — execCommand's optional args (showUI, value) pass through.
        return (
          originalExec as (cmd: string, ...args: unknown[]) => boolean
        )(command, ...rest);
      };
    });
  });

  test("emits a <style data-tpl-custom-block-stylesheet> with the definition's CSS in the editor root", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Product Launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Wait until the composable has emitted the stylesheet — `waitForReady`
    // only guarantees the canvas DOM shell, not that the content has been
    // processed.
    await expect
      .poll(() => readStylesheetTextContents(page).then((s) => s.length))
      .toBe(1);

    const [cssText] = await readStylesheetTextContents(page);
    expect(cssText).toContain(".tplc-testimonial-card");
    expect(cssText).toContain("box-shadow: rgba(0, 0, 0, 0.08)");
    expect(cssText).toContain(".tplc-testimonial-avatar");
    expect(cssText).toContain(".tplc-testimonial-byline");
    expect(cssText).toContain("@media (max-width: 480px)");
  });

  test("base rule is applied by the browser's CSS engine (transition on .tplc-testimonial-card)", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Product Launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // `transition-property: box-shadow` is declared in the stylesheet and
    // NOT set inline in the template — a matching computed value cleanly
    // proves the stylesheet was parsed AND the selector matched (not just
    // that the `<style>` tag is in the DOM).
    await expect
      .poll(() =>
        readComputedStyle(page, ".tplc-testimonial-card", [
          "transition-property",
        ]),
      )
      .toEqual({ "transition-property": "box-shadow" });
  });

  test(":hover applies the stylesheet's box-shadow", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Product Launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const card = page.locator(".tplc-testimonial-card").first();
    await card.waitFor();
    await card.scrollIntoViewIfNeeded();

    // Playwright leaves the mouse wherever the previous click landed. After
    // dismissing overlays + clicking template cards, the cursor often ends
    // up over the canvas — sometimes directly on the custom block — so
    // "rest" already matches `:hover`. Move the cursor far from the canvas
    // with intermediate interpolation steps so the browser's hit-test path
    // crosses the card's edge and fires `mouseleave` reliably; a single
    // direct move to (0, 0) sometimes doesn't propagate under parallel
    // worker load (the issue we saw flake only in the full-suite run).
    await page.mouse.move(2000, 2000, { steps: 5 });

    // At rest, no box-shadow.
    await expect
      .poll(() =>
        readComputedStyle(page, ".tplc-testimonial-card", ["box-shadow"]).then(
          (v) => v?.["box-shadow"] ?? "",
        ),
      )
      .toBe("none");

    await card.hover();

    // After hover, the stylesheet's box-shadow declaration kicks in. The
    // 200ms transition is handled by `expect.poll`'s retry loop — no
    // `waitForTimeout` needed.
    await expect
      .poll(
        () =>
          readComputedStyle(page, ".tplc-testimonial-card", [
            "box-shadow",
          ]).then((v) => v?.["box-shadow"] ?? ""),
        { timeout: 2000 },
      )
      .toContain("rgba(0, 0, 0, 0.08)");
  });

  test("layout stacks on mobile viewport (@media (max-width: 480px) fires)", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    // Narrow the browser viewport BEFORE the editor mounts so the media
    // query is evaluated as "mobile" from the start — avoids racing the
    // canvas's own layout transitions and the CSSOM media-query rematch.
    // The playground header/chooser may overflow at this width; that's
    // fine — we only care about the testimonial's computed style.
    await page.setViewportSize({ width: 400, height: 800 });

    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Product Launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Both author-row TDs default to `display: table-cell`. The mobile
    // override switches them to `display: block` with full width — the
    // visible result is "avatar above byline, both full-width, centered".
    await expect
      .poll(() =>
        readComputedStyle(page, ".tplc-testimonial-avatar", [
          "display",
          "text-align",
        ]),
      )
      .toEqual({ display: "block", "text-align": "center" });

    await expect
      .poll(() =>
        readComputedStyle(page, ".tplc-testimonial-byline", [
          "display",
          "text-align",
        ]),
      )
      .toEqual({ display: "block", "text-align": "center" });
  });

  test("desktop viewport keeps the 2-column layout (no @media match)", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Product Launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Negative case for the mobile test above: at the default (desktop)
    // viewport, the stylesheet's mobile rule must NOT fire. `display`
    // stays at the table-cell default — proves the @media gate works
    // correctly, not just that the rule exists.
    await expect
      .poll(() =>
        readComputedStyle(page, ".tplc-testimonial-byline", ["display"]).then(
          (v) => v?.["display"] ?? "",
        ),
      )
      .toBe("table-cell");
  });

  test("editor.toMjml() output contains the stylesheet inside <mj-head><mj-style>", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    // Drive the export through the playground's `__tplPlaygroundGetMjml`
    // test affordance (installed by `apps/playground/src/App.vue` after
    // editor init). That calls `editor.toMjml()` directly — same code
    // path the export modal uses — without depending on copy-to-clipboard,
    // CodeMirror virtualization, or DOM inspection of the rendered MJML.
    // Deterministic in headless Chromium CI where clipboard APIs are
    // unreliable.
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Product Launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Wait for the hook to be installed (editor init is async).
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            typeof (
              window as { __tplPlaygroundGetMjml?: () => Promise<string> }
            ).__tplPlaygroundGetMjml === "function",
        ),
      )
      .toBe(true);

    const mjml = await page.evaluate(async () =>
      (
        window as { __tplPlaygroundGetMjml?: () => Promise<string> }
      ).__tplPlaygroundGetMjml!(),
    );
    expect(mjml.length).toBeGreaterThan(100);

    // 1. The MJML output exists and is well-formed (sanity).
    expect(mjml).toContain("<mjml");
    expect(mjml).toContain("<mj-head>");
    expect(mjml).toContain("</mj-head>");

    // 2. The testimonial's CSS rules from `stylesheet` are emitted —
    //    proves the renderer's `getCustomBlockStylesheet` resolver was
    //    wired through from the editor's block registry.
    expect(mjml).toContain(".tplc-testimonial-card");
    expect(mjml).toContain(".tplc-testimonial-avatar");
    expect(mjml).toContain(".tplc-testimonial-byline");
    expect(mjml).toContain("@media (max-width: 480px)");

    // 3. The CSS sits inside a `<mj-style>` block, and that block sits
    //    inside `<mj-head>` — not bare in head, not in body. The regex
    //    bounds both wraps so a future refactor that drops either fails
    //    this test.
    expect(mjml).toMatch(
      /<mj-head>[\s\S]*<mj-style>[\s\S]*\.tplc-testimonial-card[\s\S]*<\/mj-style>[\s\S]*<\/mj-head>/,
    );

    // 4. The CSS does NOT leak into mj-body (where consumer HTML lands).
    const bodyStart = mjml.indexOf("</mj-head>");
    const bodyEnd = mjml.indexOf("</mj-body>");
    if (bodyStart >= 0 && bodyEnd > bodyStart) {
      const bodySection = mjml.slice(bodyStart, bodyEnd);
      // The class names appear in the rendered HTML inside mj-body (that's
      // the testimonial's actual markup) but the @media RULE must not.
      expect(bodySection).not.toContain("@media (max-width: 480px)");
    }
  });

  test("removing the last instance clears the <style> element", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Product Launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Confirm the stylesheet is present to start.
    await expect
      .poll(() => readStylesheetTextContents(page).then((s) => s.length))
      .toBe(1);

    // Select the custom block. `[data-block-type="custom"]` is the block
    // wrapper's stable test selector.
    const customBlock = page.locator('[data-block-type="custom"]').first();
    await customBlock.scrollIntoViewIfNeeded();
    await customBlock.click();
    await page.locator(SELECTORS.blockActions).waitFor();
    await editorPage.deleteSelectedBlock();

    // The composable is reactive: once the last instance of the custom type
    // is gone, the stylesheet drops out of the list and the `<style>`
    // element is removed from the DOM.
    await expect
      .poll(() => readStylesheetTextContents(page).then((s) => s.length))
      .toBe(0);
  });
});
