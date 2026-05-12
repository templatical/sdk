import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Phase 6.1a — shadow-mode layout + utility-class gate.
 *
 * Two regressions surfaced via manual testing during Phase 1 that the
 * unit smoke test missed:
 *   1. Dev-mode CSS missing Tailwind utilities (`?inline` of source CSS
 *      stripped @import via replaceSync → no utilities in the adopted
 *      stylesheet).
 *   2. Editor host div had no explicit height → editor chrome collapsed
 *      to content height because the height-100% ancestor chain broke at
 *      the shadow boundary.
 *
 * This spec runs only against the `chromium-shadow` project and asserts:
 *   - The shadow root is attached to the editor container.
 *   - The popover root is rendered inside the shadow tree.
 *   - Editor's outermost element fills its container height (no collapse).
 *   - A representative Tailwind utility class element has its computed
 *     style applied inside the shadow tree (catches "CSS not adopted").
 *
 * If a future change re-introduces either regression class, this fails
 * before Phase 7's default flip ships.
 */
test.describe("Shadow DOM layout + utility gate", () => {
  test.skip(
    ({ shadowDom }) => !shadowDom,
    "shadow-mode-only assertions",
  );

  test("editor mounts inside a shadow root with adopted stylesheets", async ({
    editorReady,
    page,
  }) => {
    const { editorPage } = editorReady;
    void editorPage; // unused — fixture already navigated + readied

    const result = await page.evaluate((containerSel) => {
      const container = document.querySelector(containerSel) as
        | HTMLElement
        | null;
      if (!container) return { error: "container not found" };
      const shadow = container.shadowRoot;
      if (!shadow) return { error: "no shadow root attached" };
      const adopted = shadow.adoptedStyleSheets?.length ?? 0;
      const host = shadow.querySelector(".tpl-editor-host") as HTMLElement | null;
      const popoverRoot = shadow.querySelector(
        ".tpl-popover-root",
      ) as HTMLElement | null;
      return {
        adopted,
        hasHost: !!host,
        hasPopoverRoot: !!popoverRoot,
      };
    }, SELECTORS.editorContainer);

    expect(result.error).toBeUndefined();
    expect(result.adopted).toBeGreaterThan(0);
    expect(result.hasHost).toBe(true);
    expect(result.hasPopoverRoot).toBe(true);
  });

  test("editor host fills its container height (no collapse)", async ({
    editorReady,
    page,
  }) => {
    void editorReady;
    const sizes = await page.evaluate((containerSel) => {
      const container = document.querySelector(containerSel) as
        | HTMLElement
        | null;
      if (!container) return null;
      const shadow = container.shadowRoot;
      const host = shadow?.querySelector(
        ".tpl-editor-host",
      ) as HTMLElement | null;
      if (!host) return null;
      return {
        containerHeight: container.getBoundingClientRect().height,
        hostHeight: host.getBoundingClientRect().height,
      };
    }, SELECTORS.editorContainer);

    expect(sizes).not.toBe(null);
    // Host must fill its container; tolerate sub-pixel rounding (Chromium
    // emits ~2px discrepancies on retina viewports). 4px keeps the trip
    // wire wide enough to catch the "host collapsed to content height"
    // regression class while ignoring rounding noise.
    expect(sizes!.hostHeight).toBeGreaterThan(0);
    expect(Math.abs(sizes!.hostHeight - sizes!.containerHeight)).toBeLessThan(
      4,
    );
  });

  test("Tailwind utility class resolves inside the shadow root", async ({
    editorReady,
    page,
  }) => {
    void editorReady;
    // The editor header uses `tpl:grid` (Tailwind utility → display: grid).
    // If utilities aren't in the adopted stylesheet, computed display
    // falls back to block — the assertion below trips on either
    // regression class (CSS pipeline broken OR utility selector missing).
    const computedDisplay = await page.evaluate((containerSel) => {
      const container = document.querySelector(containerSel) as
        | HTMLElement
        | null;
      const shadow = container?.shadowRoot;
      const header = shadow?.querySelector(".tpl-header") as HTMLElement | null;
      if (!header) return null;
      return window.getComputedStyle(header).display;
    }, SELECTORS.editorContainer);

    expect(computedDisplay).toBe("grid");
  });
});
