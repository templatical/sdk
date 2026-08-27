import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";

/**
 * A dialog must paint above the host page's own chrome, not beneath it.
 *
 * The editor renders its modals into `.tpl-popover-root` at `z-index: 10000`,
 * which only wins inside the stacking context it lives in. If the host wraps the
 * editor container in a stacking context — `isolation: isolate`, `transform`,
 * `filter`, `will-change`, `opacity < 1`, a positioned element with a
 * `z-index` — then that whole subtree is confined, and any host chrome with a
 * higher z-index in the parent context paints over every editor modal. A
 * `fixed` descendant cannot escape an isolated ancestor at any z-index.
 *
 * The playground hit exactly this: `isolate` on the editor container, and a
 * `<header>` at `z-index: 100`. The modal is centred in the viewport, so its top
 * edge sits at `0.05 * (viewportHeight - 32) + 16`; below roughly a 672px
 * viewport that crosses the 48px header and the dialog's title disappears behind
 * the toolbar. Measured at 380px: 15px of the panel hidden, with
 * `elementFromPoint` at the panel's top edge returning the HEADER.
 *
 * This is the #575 follow-up — a stacking defect, distinct from the
 * containing-block sizing defect that `modal-height-clamp.spec.ts` covers. The
 * two are independent: the panel can be correctly sized and still be painted
 * under the host's chrome.
 *
 * The assertion is `elementFromPoint`, deliberately. Comparing z-index values
 * proves nothing here — the editor's 10000 is genuinely larger than the header's
 * 100, and it lost anyway, because the numbers are compared in different
 * stacking contexts. Only hit-testing answers "what does the user actually see
 * and click".
 */

/** Short enough that the centred panel's top edge crosses the 48px header. */
const OVERLAP_VIEWPORT = { width: 1280, height: 380 };

async function openTestEmail(page: Page): Promise<void> {
  await page.locator(SELECTORS.testEmailTrigger).click();
  await expect(page.locator(SELECTORS.testEmailDialog)).toBeVisible();
}

/**
 * What actually paints at a point, from the top document. `elementFromPoint` on
 * `document` stops at the shadow host, so the result is reported as the host
 * when the modal (inside the shadow root) is on top — which is the correct
 * answer for "is the host's own header covering this point".
 */
async function paintedAtPanelTopEdge(page: Page): Promise<{
  hostHeaderHits: string[];
  panelTop: number;
  headerBottom: number;
  overlapPx: number;
}> {
  return page.evaluate(() => {
    const hosts = Array.from(document.querySelectorAll("*")).filter(
      (el) => (el as HTMLElement).shadowRoot,
    ) as HTMLElement[];
    const roots: Array<Document | ShadowRoot> = [
      document,
      ...hosts.map((h) => h.shadowRoot!),
    ];
    let panel: HTMLElement | null = null;
    for (const root of roots) {
      const found = root.querySelector(
        '[role="dialog"][aria-labelledby="tpl-test-email-title"]',
      ) as HTMLElement | null;
      if (found) {
        panel = found;
        break;
      }
    }
    const header = document.querySelector("header") as HTMLElement | null;
    if (!panel || !header) throw new Error("panel or host header not found");

    const p = panel.getBoundingClientRect();
    const h = header.getBoundingClientRect();

    // Scan the whole band the header overlaps, across the panel's width, rather
    // than a single point: the title sits a little below the panel's edge, so
    // one probe at the very top would miss whether the heading itself is
    // legible, and a probe at the title alone passes on viewports where only
    // the panel's top corner is covered. Every point in the overlap must belong
    // to the dialog, not the host.
    const hits: string[] = [];
    const xs = [0.2, 0.5, 0.8].map((f) => Math.round(p.left + p.width * f));
    for (let y = Math.round(p.top) + 2; y < Math.min(h.bottom, p.bottom); y += 4) {
      for (const x of xs) {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        if (el && (header === el || header.contains(el))) {
          hits.push(`${x},${y}:${el.tagName}`);
        }
      }
    }

    return {
      hostHeaderHits: hits,
      panelTop: Math.round(p.top),
      headerBottom: Math.round(h.bottom),
      overlapPx: Math.round(h.bottom - p.top),
    };
  });
}

test.describe("modal stacking", () => {
  test("the host header does not paint over the dialog", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.setViewportSize(OVERLAP_VIEWPORT);
    await openTestEmail(page);

    const painted = await paintedAtPanelTopEdge(page);

    // The geometry that makes this test meaningful: the header's box really does
    // extend past the panel's top edge, so paint order is what decides whether
    // the user can see the top of the dialog. Without this the assertion below
    // would pass on any viewport where the two simply don't overlap.
    expect(painted.overlapPx).toBeGreaterThan(0);
    expect(painted.panelTop).toBeLessThan(painted.headerBottom);

    // Pre-fix every one of these returned the HEADER.
    expect(painted.hostHeaderHits).toEqual([]);
  });

  test("the editor container establishes no stacking context", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    // The structural cause, asserted directly so a reintroduced `isolate` (or a
    // transform/filter/opacity added for a visual flourish) fails here with a
    // clear message rather than as a puzzling paint-order failure above.
    const container = await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="editor-container"]',
      ) as HTMLElement | null;
      if (!el) throw new Error("editor container not found");
      const cs = getComputedStyle(el);
      return {
        isolation: cs.isolation,
        transform: cs.transform,
        filter: cs.filter,
        willChange: cs.willChange,
        opacity: cs.opacity,
        perspective: cs.perspective,
        contain: cs.contain,
        mixBlendMode: cs.mixBlendMode,
      };
    });

    expect(container.isolation).toBe("auto");
    expect(container.transform).toBe("none");
    expect(container.filter).toBe("none");
    expect(container.perspective).toBe("none");
    expect(container.opacity).toBe("1");
    expect(container.mixBlendMode).toBe("normal");
  });
});
